import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  CampaignJob,
  CampaignJobStatus,
  CampaignMetrics,
  CampaignRun,
  CampaignRunStatus,
  CreateCampaignRunInput,
} from './campaign.types';

interface DatabaseServiceLike {
  getDatabase?: (name?: string) => Database.Database;
  getConnection?: (name?: string) => Database.Database;
  db?: Database.Database;
}

interface CampaignRunRow {
  id: string;
  campaign_id: string;
  name: string;
  status: CampaignRunStatus;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  total_jobs: number;
  queued_jobs: number;
  sent_jobs: number;
  failed_jobs: number;
  skipped_jobs: number;
  cancelled_jobs: number;
  metadata_json: string | null;
}

interface CampaignJobRow {
  id: string;
  run_id: string;
  campaign_id: string;
  recipient_id: string;
  phone: string;
  name: string | null;
  status: CampaignJobStatus;
  message: string;
  error: string | null;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

interface JobCountRow {
  status: CampaignJobStatus;
  count: number;
}

interface MetricsCampaignRow {
  campaign_id: string;
  runs: number;
  jobs: number;
  sent: number;
  failed: number;
  skipped: number;
}

@Injectable()
export class CampaignRepository implements OnModuleInit {
  private readonly logger = new Logger(CampaignRepository.name);
  private db: Database.Database;

  constructor(
    @Optional()
    @Inject('DatabaseService')
    private readonly databaseService?: DatabaseServiceLike,
  ) {}

  onModuleInit(): void {
    this.db = this.resolveDatabase();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaign_runs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        total_jobs INTEGER NOT NULL DEFAULT 0,
        queued_jobs INTEGER NOT NULL DEFAULT 0,
        sent_jobs INTEGER NOT NULL DEFAULT 0,
        failed_jobs INTEGER NOT NULL DEFAULT 0,
        skipped_jobs INTEGER NOT NULL DEFAULT 0,
        cancelled_jobs INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS campaign_jobs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        name TEXT,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sent_at TEXT,
        FOREIGN KEY (run_id) REFERENCES campaign_runs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_campaign_jobs_run_id ON campaign_jobs(run_id);
      CREATE INDEX IF NOT EXISTS idx_campaign_jobs_status_next ON campaign_jobs(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_campaign_runs_status ON campaign_runs(status);
    `);
    this.logger.log('Campaign SQLite tables initialized');
  }

  listRuns(): CampaignRun[] {
    const rows = this.db
      .prepare('SELECT * FROM campaign_runs ORDER BY created_at DESC')
      .all() as CampaignRunRow[];
    return rows.map((row) => this.mapRun(row));
  }

  getRun(runId: string): CampaignRun | null {
    const row = this.db.prepare('SELECT * FROM campaign_runs WHERE id = ?').get(runId) as
      | CampaignRunRow
      | undefined;
    return row ? this.mapRun(row) : null;
  }

  listJobs(runId: string): CampaignJob[] {
    const rows = this.db
      .prepare('SELECT * FROM campaign_jobs WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as CampaignJobRow[];
    return rows.map((row) => this.mapJob(row));
  }

  createRun(
    input: CreateCampaignRunInput,
    campaignName: string,
    jobs: Array<{
      phone: string;
      recipientId: string;
      name?: string;
      message: string;
      status: CampaignJobStatus;
      error?: string;
      maxAttempts: number;
    }>,
  ): CampaignRun {
    const now = new Date().toISOString();
    const runId = randomUUID();
    const counts = this.countStatuses(jobs.map((job) => job.status));

    const create = this.db.transaction(() => {
      this.db
        .prepare(
          `
          INSERT INTO campaign_runs
            (id, campaign_id, name, status, created_at, updated_at, total_jobs, queued_jobs,
             sent_jobs, failed_jobs, skipped_jobs, cancelled_jobs, metadata_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `,
        )
        .run(
          runId,
          input.campaignId,
          campaignName,
          counts.queued > 0 ? 'queued' : 'completed',
          now,
          now,
          jobs.length,
          counts.queued,
          counts.failed,
          counts.skipped,
          counts.cancelled,
          input.metadata ? JSON.stringify({ ...input.metadata, requestedBy: input.requestedBy }) : null,
        );

      const insertJob = this.db.prepare(
        `
        INSERT INTO campaign_jobs
          (id, run_id, campaign_id, recipient_id, phone, name, status, message, error,
           attempts, max_attempts, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `,
      );

      for (const job of jobs) {
        insertJob.run(
          randomUUID(),
          runId,
          input.campaignId,
          job.recipientId,
          job.phone,
          job.name ?? null,
          job.status,
          job.message,
          job.error ?? null,
          job.maxAttempts,
          now,
          now,
        );
      }
    });

    create();
    const run = this.getRun(runId);
    if (!run) throw new Error(`Failed to create campaign run ${runId}`);
    return run;
  }

  findNextQueuedJob(now = new Date()): CampaignJob | null {
    const row = this.db
      .prepare(
        `
        SELECT j.*
        FROM campaign_jobs j
        JOIN campaign_runs r ON r.id = j.run_id
        WHERE j.status = 'queued'
          AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= ?)
          AND r.status IN ('queued', 'running')
        ORDER BY j.created_at ASC
        LIMIT 1
      `,
      )
      .get(now.toISOString()) as CampaignJobRow | undefined;
    return row ? this.mapJob(row) : null;
  }

  markRunStarted(runId: string): CampaignRun | null {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE campaign_runs
        SET status = 'running',
            started_at = COALESCE(started_at, ?),
            updated_at = ?
        WHERE id = ? AND status = 'queued'
      `,
      )
      .run(now, now, runId);
    return this.getRun(runId);
  }

  markJobSending(jobId: string): CampaignJob | null {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE campaign_jobs
        SET status = 'sending',
            attempts = attempts + 1,
            updated_at = ?
        WHERE id = ? AND status = 'queued'
      `,
      )
      .run(now, jobId);
    return this.getJob(jobId);
  }

  markJobSent(jobId: string): CampaignJob | null {
    const now = new Date().toISOString();
    const job = this.getJob(jobId);
    if (!job) return null;

    this.db
      .prepare(
        `
        UPDATE campaign_jobs
        SET status = 'sent',
            error = NULL,
            sent_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      )
      .run(now, now, jobId);
    this.refreshRunCounts(job.runId);
    return this.getJob(jobId);
  }

  markJobSkipped(jobId: string, reason: string): CampaignJob | null {
    const now = new Date().toISOString();
    const job = this.getJob(jobId);
    if (!job) return null;

    this.db
      .prepare(
        `
        UPDATE campaign_jobs
        SET status = 'skipped',
            error = ?,
            updated_at = ?
        WHERE id = ?
      `,
      )
      .run(reason, now, jobId);
    this.refreshRunCounts(job.runId);
    return this.getJob(jobId);
  }

  markJobFailed(jobId: string, error: string, retryDelayMs: number): CampaignJob | null {
    const now = new Date();
    const job = this.getJob(jobId);
    if (!job) return null;

    const shouldRetry = job.attempts < job.maxAttempts;
    const status: CampaignJobStatus = shouldRetry ? 'queued' : 'failed';
    const nextAttemptAt = shouldRetry ? new Date(now.getTime() + retryDelayMs).toISOString() : null;

    this.db
      .prepare(
        `
        UPDATE campaign_jobs
        SET status = ?,
            error = ?,
            next_attempt_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      )
      .run(status, error, nextAttemptAt, now.toISOString(), jobId);
    this.refreshRunCounts(job.runId);
    return this.getJob(jobId);
  }

  setRunStatus(runId: string, status: CampaignRunStatus): CampaignRun | null {
    const now = new Date().toISOString();
    const finishedAt = ['cancelled', 'completed', 'completed_with_errors'].includes(status) ? now : null;
    this.db
      .prepare(
        `
        UPDATE campaign_runs
        SET status = ?,
            finished_at = COALESCE(?, finished_at),
            updated_at = ?
        WHERE id = ?
      `,
      )
      .run(status, finishedAt, now, runId);
    return this.getRun(runId);
  }

  cancelQueuedJobs(runId: string): number {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `
        UPDATE campaign_jobs
        SET status = 'cancelled',
            error = 'Run cancelled',
            updated_at = ?
        WHERE run_id = ? AND status = 'queued'
      `,
      )
      .run(now, runId);
    this.refreshRunCounts(runId);
    return result.changes;
  }

  refreshRunCounts(runId: string): CampaignRun | null {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) as count FROM campaign_jobs WHERE run_id = ? GROUP BY status')
      .all(runId) as JobCountRow[];
    const counts = this.countStatuses(rows.flatMap((row) => Array(row.count).fill(row.status)));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const terminal = counts.sent + counts.failed + counts.skipped + counts.cancelled;
    const status = this.getNextRunStatus(runId, total, terminal, counts);
    const now = new Date().toISOString();
    const finishedAt = ['completed', 'completed_with_errors', 'cancelled'].includes(status) ? now : null;

    this.db
      .prepare(
        `
        UPDATE campaign_runs
        SET status = ?,
            updated_at = ?,
            finished_at = COALESCE(?, finished_at),
            total_jobs = ?,
            queued_jobs = ?,
            sent_jobs = ?,
            failed_jobs = ?,
            skipped_jobs = ?,
            cancelled_jobs = ?
        WHERE id = ?
      `,
      )
      .run(
        status,
        now,
        finishedAt,
        total,
        counts.queued,
        counts.sent,
        counts.failed,
        counts.skipped,
        counts.cancelled,
        runId,
      );
    return this.getRun(runId);
  }

  metrics(): CampaignMetrics {
    const totals = this.db
      .prepare(
        `
        SELECT
          COUNT(*) as jobs,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM campaign_jobs
      `,
      )
      .get() as Omit<CampaignMetrics, 'runs' | 'byCampaign'>;
    const runs = (this.db.prepare('SELECT COUNT(*) as count FROM campaign_runs').get() as { count: number }).count;
    const byCampaign = this.db
      .prepare(
        `
        SELECT
          r.campaign_id,
          COUNT(DISTINCT r.id) as runs,
          COUNT(j.id) as jobs,
          SUM(CASE WHEN j.status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN j.status = 'skipped' THEN 1 ELSE 0 END) as skipped
        FROM campaign_runs r
        LEFT JOIN campaign_jobs j ON j.run_id = r.id
        GROUP BY r.campaign_id
        ORDER BY r.campaign_id ASC
      `,
      )
      .all() as MetricsCampaignRow[];

    return {
      runs,
      jobs: totals.jobs ?? 0,
      queued: totals.queued ?? 0,
      sent: totals.sent ?? 0,
      failed: totals.failed ?? 0,
      skipped: totals.skipped ?? 0,
      cancelled: totals.cancelled ?? 0,
      byCampaign: byCampaign.map((row) => ({
        campaignId: row.campaign_id,
        runs: row.runs,
        jobs: row.jobs,
        sent: row.sent ?? 0,
        failed: row.failed ?? 0,
        skipped: row.skipped ?? 0,
      })),
    };
  }

  private getJob(jobId: string): CampaignJob | null {
    const row = this.db.prepare('SELECT * FROM campaign_jobs WHERE id = ?').get(jobId) as
      | CampaignJobRow
      | undefined;
    return row ? this.mapJob(row) : null;
  }

  private getNextRunStatus(
    runId: string,
    total: number,
    terminal: number,
    counts: Record<CampaignJobStatus, number>,
  ): CampaignRunStatus {
    const run = this.getRun(runId);
    if (!run) return 'queued';
    if (run.status === 'paused' || run.status === 'cancelled') return run.status;
    if (total > 0 && terminal === total) {
      if (counts.failed > 0 || counts.cancelled > 0) return 'completed_with_errors';
      return 'completed';
    }
    return run.startedAt ? 'running' : 'queued';
  }

  private countStatuses(statuses: CampaignJobStatus[]): Record<CampaignJobStatus, number> {
    return {
      queued: statuses.filter((status) => status === 'queued').length,
      sending: statuses.filter((status) => status === 'sending').length,
      sent: statuses.filter((status) => status === 'sent').length,
      failed: statuses.filter((status) => status === 'failed').length,
      skipped: statuses.filter((status) => status === 'skipped').length,
      cancelled: statuses.filter((status) => status === 'cancelled').length,
    };
  }

  private resolveDatabase(): Database.Database {
    const shared =
      this.databaseService?.getDatabase?.('campaigns.sqlite') ??
      this.databaseService?.getConnection?.('campaigns.sqlite') ??
      this.databaseService?.db;

    if (shared) return shared;

    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    return new Database(join(dataDir, 'campaigns.sqlite'));
  }

  private mapRun(row: CampaignRunRow): CampaignRun {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      name: row.name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
      totalJobs: row.total_jobs,
      queuedJobs: row.queued_jobs,
      sentJobs: row.sent_jobs,
      failedJobs: row.failed_jobs,
      skippedJobs: row.skipped_jobs,
      cancelledJobs: row.cancelled_jobs,
      metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
    };
  }

  private mapJob(row: CampaignJobRow): CampaignJob {
    return {
      id: row.id,
      runId: row.run_id,
      campaignId: row.campaign_id,
      recipientId: row.recipient_id,
      phone: row.phone,
      name: row.name ?? undefined,
      status: row.status,
      message: row.message,
      error: row.error ?? undefined,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      nextAttemptAt: row.next_attempt_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sentAt: row.sent_at ?? undefined,
    };
  }
}
