import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AI_PROVIDER } from '../core/tokens/injection-tokens';
import type { AIProvider } from '../core/interfaces/ai-provider.interface';
import { ConfigLoaderService } from '../config/config-loader.service';
import type { CampaignConfig } from '../config/types/campaign.types';
import type { ClientConfig } from '../config/types/bot-config.types';
import { ClientsService } from '../clients/clients.service';
import { DatabaseService } from '../data/database.service';
import { OptOutService } from '../opt-out/opt-out.service';
import { WhatsAppAdapter } from '../messaging/adapters/whatsapp.adapter';

interface CampaignPreviewItem {
  phone: string;
  name?: string;
  skipped?: boolean;
  reason?: string;
  message?: string;
}

interface CampaignRunRow {
  id: string;
  campaign_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  totals_json: string;
}

interface CampaignJobRow {
  id: string;
  run_id: string;
  campaign_id: string;
  phone: string;
  name: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  message: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private readonly configLoader: ConfigLoaderService,
    private readonly clientsService: ClientsService,
    private readonly database: DatabaseService,
    private readonly optOutService: OptOutService,
    private readonly whatsAppAdapter: WhatsAppAdapter,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
  ) {}

  listCampaigns(): CampaignConfig[] {
    return this.configLoader.campaigns;
  }

  getCampaign(id: string): CampaignConfig | null {
    return this.configLoader.campaigns.find((campaign) => campaign.id === id) ?? null;
  }

  async preview(campaignId: string, phones?: string[], limit = 10): Promise<CampaignPreviewItem[]> {
    const campaign = this.requireCampaign(campaignId);
    const targets = this.resolveTargets(campaign, phones).slice(0, limit);
    const items: CampaignPreviewItem[] = [];

    for (const client of targets) {
      if (this.optOutService.isOptedOut(client.phone)) {
        items.push({ phone: client.phone, name: client.name, skipped: true, reason: 'opt-out' });
        continue;
      }
      items.push({
        phone: client.phone,
        name: client.name,
        message: await this.renderMessage(campaign, client),
      });
    }

    return items;
  }

  async createRun(campaignId: string, phones?: string[], dryRun = false) {
    const campaign = this.requireCampaign(campaignId);
    const runId = randomUUID();
    const now = new Date().toISOString();
    const targets = this.resolveTargets(campaign, phones);
    const maxPerRun = campaign.rateLimit?.maxPerRun ?? targets.length;
    const selected = targets.slice(0, maxPerRun);
    let queued = 0;
    let skipped = 0;

    const insertRun = this.database.connection.prepare(`
      INSERT INTO campaign_runs (id, campaign_id, status, created_at, updated_at, totals_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertJob = this.database.connection.prepare(`
      INSERT INTO campaign_jobs (
        id, run_id, campaign_id, phone, name, status, attempts, max_attempts,
        message, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `);

    const tx = this.database.connection.transaction(() => {
      insertRun.run(runId, campaign.id, dryRun ? 'dry_run' : 'queued', now, now, '{}');
    });
    tx();

    for (const client of selected) {
      const optedOut = this.optOutService.isOptedOut(client.phone);
      const status = dryRun ? 'preview' : optedOut ? 'skipped' : 'queued';
      if (status === 'queued') queued++;
      if (status === 'skipped') skipped++;
      const message = await this.renderMessage(campaign, client);
      insertJob.run(
        randomUUID(),
        runId,
        campaign.id,
        client.phone,
        client.name,
        status,
        campaign.retry?.maxAttempts ?? 3,
        message,
        optedOut ? 'opt-out' : null,
        now,
        now,
      );
    }

    this.updateRunTotals(runId, { queued, skipped, total: selected.length });
    return this.getRun(runId);
  }

  getRun(runId: string) {
    const run = this.database.connection
      .prepare('SELECT * FROM campaign_runs WHERE id = ?')
      .get(runId) as CampaignRunRow | undefined;
    if (!run) return null;

    const jobs = this.database.connection
      .prepare('SELECT * FROM campaign_jobs WHERE run_id = ? ORDER BY created_at')
      .all(runId) as CampaignJobRow[];

    return {
      id: run.id,
      campaignId: run.campaign_id,
      status: run.status,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      totals: this.parseJson(run.totals_json, {}),
      jobs: jobs.map((job) => ({
        id: job.id,
        phone: job.phone,
        name: job.name ?? undefined,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.max_attempts,
        message: job.message,
        error: job.error ?? undefined,
      })),
    };
  }

  listRuns() {
    const runs = this.database.connection
      .prepare('SELECT * FROM campaign_runs ORDER BY created_at DESC')
      .all() as CampaignRunRow[];
    return runs.map((run) => ({
      id: run.id,
      campaignId: run.campaign_id,
      status: run.status,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      totals: this.parseJson(run.totals_json, {}),
    }));
  }

  setRunStatus(runId: string, status: 'queued' | 'paused' | 'cancelled') {
    this.database.connection
      .prepare('UPDATE campaign_runs SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), runId);
    if (status === 'cancelled') {
      this.database.connection
        .prepare("UPDATE campaign_jobs SET status = 'cancelled', updated_at = ? WHERE run_id = ? AND status = 'queued'")
        .run(new Date().toISOString(), runId);
    }
    return this.getRun(runId);
  }

  async processNextQueuedJob(runId: string) {
    const run = this.database.connection
      .prepare('SELECT * FROM campaign_runs WHERE id = ?')
      .get(runId) as CampaignRunRow | undefined;
    if (!run) throw new Error(`Campaign run not found: ${runId}`);
    if (run.status === 'paused' || run.status === 'cancelled') return this.getRun(runId);

    const job = this.database.connection
      .prepare("SELECT * FROM campaign_jobs WHERE run_id = ? AND status = 'queued' ORDER BY created_at LIMIT 1")
      .get(runId) as CampaignJobRow | undefined;
    if (!job) {
      this.database.connection
        .prepare('UPDATE campaign_runs SET status = ?, updated_at = ? WHERE id = ?')
        .run('completed', new Date().toISOString(), runId);
      return this.getRun(runId);
    }

    const now = new Date().toISOString();
    this.database.connection
      .prepare("UPDATE campaign_jobs SET status = 'sending', attempts = attempts + 1, updated_at = ? WHERE id = ?")
      .run(now, job.id);

    try {
      await this.whatsAppAdapter.sendBroadcast(`${job.phone}@c.us`, job.message);
      this.database.connection
        .prepare("UPDATE campaign_jobs SET status = 'sent', error = NULL, updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), job.id);
    } catch (error) {
      const attempts = job.attempts + 1;
      const status = attempts >= job.max_attempts ? 'failed' : 'queued';
      this.database.connection
        .prepare('UPDATE campaign_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?')
        .run(status, (error as Error).message, new Date().toISOString(), job.id);
      this.logger.warn(`Campaign job ${job.id} failed: ${(error as Error).message}`);
    }

    this.recomputeRunTotals(runId);
    return this.getRun(runId);
  }

  private requireCampaign(id: string): CampaignConfig {
    const campaign = this.getCampaign(id);
    if (!campaign) throw new Error(`Campaign not found: ${id}`);
    if (!campaign.enabled) throw new Error(`Campaign disabled: ${id}`);
    return campaign;
  }

  private resolveTargets(campaign: CampaignConfig, phones?: string[]): ClientConfig[] {
    const clients = this.clientsService.findAll();
    const requested = phones?.map((phone) => phone.replace(/\D/g, ''));
    if (requested?.length) {
      return clients.filter((client) => requested.includes(client.phone.replace(/\D/g, '')));
    }

    switch (campaign.audience.mode) {
      case 'phones':
        return clients.filter((client) => campaign.audience.phones?.includes(client.phone));
      case 'systems':
        return clients.filter((client) =>
          client.systems.some((system) => campaign.audience.systems?.includes(system)),
        );
      case 'companies':
        return clients.filter((client) => campaign.audience.companies?.includes(client.company));
      default:
        return clients;
    }
  }

  private async renderMessage(campaign: CampaignConfig, client: ClientConfig): Promise<string> {
    const vars = {
      phone: client.phone,
      name: client.name,
      company: client.company,
      systems: client.systems.join(', '),
    };

    if (campaign.template) {
      return this.interpolate(campaign.template, vars);
    }

    const prompt = this.interpolate(campaign.aiPrompt ?? 'Escribi un mensaje breve para {name}.', vars);
    const response = await this.aiProvider.generate({
      prompt,
      systemPrompt: campaign.systemPrompt ?? 'Escribi mensajes breves y naturales para WhatsApp.',
    });
    return response.text.trim();
  }

  private updateRunTotals(runId: string, totals: Record<string, unknown>): void {
    this.database.connection
      .prepare('UPDATE campaign_runs SET totals_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(totals), new Date().toISOString(), runId);
  }

  private recomputeRunTotals(runId: string): void {
    const rows = this.database.connection
      .prepare('SELECT status, COUNT(*) as n FROM campaign_jobs WHERE run_id = ? GROUP BY status')
      .all(runId) as Array<{ status: string; n: number }>;
    const totals = Object.fromEntries(rows.map((row) => [row.status, row.n]));
    totals.total = rows.reduce((sum, row) => sum + row.n, 0);
    this.updateRunTotals(runId, totals);
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
  }

  private parseJson<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
