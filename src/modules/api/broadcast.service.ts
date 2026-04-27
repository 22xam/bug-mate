import { Injectable, Inject, Logger } from '@nestjs/common';
import { AI_PROVIDER } from '../core/tokens/injection-tokens';
import type { AIProvider } from '../core/interfaces/ai-provider.interface';
import { ConfigLoaderService } from '../config/config-loader.service';
import { WhatsAppAdapter } from '../messaging/adapters/whatsapp.adapter';

export interface BroadcastResult {
  phone: string;
  name?: string;
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
}

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly configLoader: ConfigLoaderService,
    private readonly whatsAppAdapter: WhatsAppAdapter,
  ) {}

  async sendCampaignIntro(requestedPhones: string[]): Promise<BroadcastResult[]> {
    const clients = this.configLoader.clients;

    // Only send to phones registered in clients.json
    const targets = requestedPhones
      .map((phone) => {
        const normalized = phone.replace(/\D/g, '');
        const client = clients.find((c) => c.phone.replace(/\D/g, '') === normalized);
        return { phone: normalized, client };
      })
      .filter((t) => t.client !== undefined);

    const skipped = requestedPhones.filter((phone) => {
      const normalized = phone.replace(/\D/g, '');
      return !clients.find((c) => c.phone.replace(/\D/g, '') === normalized);
    });

    if (skipped.length > 0) {
      this.logger.warn(`Skipping non-client phones: ${skipped.join(', ')}`);
    }

    if (targets.length === 0) {
      return skipped.map((phone) => ({
        phone,
        status: 'skipped' as const,
        error: 'No registrado como cliente',
      }));
    }

    this.logger.log(`Starting campaign broadcast to ${targets.length} contacts`);
    const results: BroadcastResult[] = [];

    for (let i = 0; i < targets.length; i++) {
      const { phone, client } = targets[i];
      const recipientId = `${phone}@c.us`;

      let sent = false;
      let lastError = '';
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          this.logger.log(`Generating message for ${client!.name} (attempt ${attempt}/${maxAttempts})`);
          const message = await this.generateCampaignMessage(client!.name);
          await this.whatsAppAdapter.sendBroadcast(recipientId, message);
          this.logger.log(`Campaign message sent to ${client!.name} (${phone})`);
          results.push({ phone, name: client!.name, status: 'sent' });
          sent = true;
          break;
        } catch (error) {
          lastError = (error as Error).message;
          this.logger.warn(`Attempt ${attempt}/${maxAttempts} failed for ${phone}: ${lastError}`);
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
      }

      if (!sent) {
        this.logger.error(`All ${maxAttempts} attempts failed for ${phone}: ${lastError}`);
        results.push({ phone, name: client!.name, status: 'failed', error: lastError });
      }

      // Delay between recipients to avoid WhatsApp rate limiting
      if (i < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    }

    skipped.forEach((phone) =>
      results.push({ phone, status: 'skipped', error: 'No registrado como cliente' }),
    );

    return results;
  }

  private async generateCampaignMessage(recipientName: string): Promise<string> {
    const prompt = `Escribí un mensaje de WhatsApp de campaña para ${recipientName}, afiliado/a de AMET Regional XIII Salta (docente de escuela técnica).

CONTEXTO: Las elecciones de AMET son el 5 de mayo de 2025. Lista 26 Roja — Dignidad y Trabajo es una lista nueva, no la conducción actual. Venimos a cambiar lo que no funciona.

ESTRUCTURA EXACTA (4 líneas máximo + firma):
1. Gancho con el nombre y una verdad que duele ("sabés mejor que nadie lo que es llegar al taller sin insumos")
2. Identidad compartida + diferenciación suave ("por eso nos juntamos, porque esto tiene que cambiar")
3. Urgencia + CTA ("el 5 de mayo es nuestra oportunidad — ¿te cuento qué proponemos?")
4. Firma: *Evangelina* — Lista 26 Roja 🔴

REGLAS:
- Máximo 4 líneas en total, incluyendo firma
- 1 solo emoji (el de la firma)
- Español salteño, tuteo, tono de compañera — nunca discurso político
- La pregunta final debe invitar a responder, no a hacer clic en un link
- NO menciones el sitio web en este primer mensaje — primero la conversación

Respondé solo con el mensaje listo, sin comillas ni explicaciones.`;

    const response = await this.aiProvider.generate({
      prompt,
      systemPrompt:
        'Sos Evangelina, compañera docente y voz de Lista 26 Roja — Dignidad y Trabajo, AMET Regional XIII Salta. Escribís mensajes de campaña breves, honestos y que generan conversación. El objetivo es que el afiliado responda, no que lea un folleto.',
    });

    return response.text.trim();
  }
}
