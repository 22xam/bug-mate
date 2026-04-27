import type { Client } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { clearQrFile, saveQrToFile, type McpLogger } from './mcp-logger.js';
import type { WhatsAppClientFactory } from './whatsapp-client.factory.js';
import type {
  WhatsAppClientProvider,
  WhatsAppConnectionState,
} from './whatsapp-tool-runner.js';

export class WhatsAppLifecycleService implements WhatsAppClientProvider {
  private client: Client;
  private ready = false;
  private readyAt: number | null = null;
  private readonly initTimeoutMs = Number.parseInt(
    process.env['WHATSAPP_INIT_TIMEOUT_MS'] ?? '45000',
    10,
  );

  constructor(
    private readonly clientFactory: WhatsAppClientFactory,
    private readonly logger: McpLogger,
  ) {
    this.client = this.clientFactory.create();
  }

  getClient(): Client {
    return this.client;
  }

  getState(): WhatsAppConnectionState {
    return {
      ready: this.ready,
      readyAt: this.readyAt,
    };
  }

  registerEvents(): void {
    this.client.on('qr', (qr) => {
      this.logger.log('QR received', { length: qr.length });
      process.stderr.write('\n[MCP] Escanea el QR con tu telefono:\n');
      qrcode.generate(qr, { small: true }, (code) => {
        process.stderr.write(code + '\n');
        saveQrToFile(code);
      });
    });

    this.client.on('authenticated', () => {
      this.logger.log('WhatsApp authenticated');
      clearQrFile();
      process.stderr.write('[MCP] WhatsApp autenticado\n');
    });

    this.client.on('ready', () => {
      this.ready = true;
      this.readyAt = Date.now();
      this.logger.log('WhatsApp ready');
      process.stderr.write('[MCP] WhatsApp listo - MCP server operativo\n');

      // Detect browser crash/close that doesn't trigger 'disconnected'
      const pupBrowser = (this.client as any).pupBrowser;
      if (pupBrowser) {
        pupBrowser.on('disconnected', () => {
          if (this.ready) {
            this.ready = false;
            this.logger.log('Puppeteer browser disconnected — scheduling reconnect');
            void this.reconnect();
          }
        });
      }
    });

    this.client.on('disconnected', (reason) => {
      this.ready = false;
      this.logger.log('WhatsApp disconnected', { reason });
      process.stderr.write(`[MCP] WhatsApp desconectado: ${reason}\n`);
    });

    this.client.on('auth_failure', (message) => {
      this.logger.log('WhatsApp auth failure', { message });
      process.stderr.write(`[MCP] Fallo de autenticacion: ${message}\n`);
    });

    this.client.on('loading_screen', (percent, message) => {
      this.logger.log('WhatsApp loading screen', { percent, message });
    });

    this.client.on('change_state', (state) => {
      this.logger.log('WhatsApp state changed', { state });
    });
  }

  async initializeWithRetry(maxAttempts = 3): Promise<void> {
    setImmediate(() => {
      void this.initializeWithRetryInBackground(maxAttempts);
    });
  }

  private async initializeWithRetryInBackground(maxAttempts: number): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        this.ready = false;
        this.readyAt = null;
        this.logger.log('Initializing WhatsApp client', {
          attempt,
          maxAttempts,
        });
        const initPromise = this.client.initialize();
        initPromise.catch((error) => {
          this.logger.log('WhatsApp initialize rejected after start', {
            attempt,
            error: (error as Error).message,
            stack: (error as Error).stack,
          });
        });
        await this.withTimeout(
          initPromise,
          Number.isFinite(this.initTimeoutMs) ? this.initTimeoutMs : 45000,
          'WhatsApp initialization is still running in the background',
        );
        this.logger.log('WhatsApp initialize returned', { attempt });
        return;
      } catch (error) {
        const err = error as Error;
        if (/still running in the background/i.test(err.message)) {
          this.logger.log('WhatsApp initialize timed out but continues in background', {
            attempt,
            timeoutMs: Number.isFinite(this.initTimeoutMs) ? this.initTimeoutMs : 45000,
          });
          process.stderr.write('[MCP] WhatsApp sigue iniciando en segundo plano\n');
          return;
        }

        const browserProfileLocked =
          /browser is already running|Use a different `userDataDir`/i.test(
            err.message,
          );
        const retryable =
          browserProfileLocked ||
          /Execution context was destroyed|Target closed|Protocol error|Navigat|detached/i.test(
            err.message,
          );

        this.logger.log('WhatsApp initialize failed', {
          attempt,
          maxAttempts,
          retryable,
          error: err.message,
          stack: err.stack,
        });

        if (!retryable || attempt === maxAttempts) throw err;

        if (browserProfileLocked) {
          await this.cleanupBrowserProcesses();
        }

        await this.destroyAfterFailure();
        await new Promise((resolve) => setTimeout(resolve, 2000));

        this.client = this.clientFactory.create();
        this.registerEvents();
      }
    }
  }

  async reconnect(): Promise<void> {
    this.logger.log('Reconnecting WhatsApp client after detached frame');
    await this.destroyAfterFailure();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    this.client = this.clientFactory.create();
    this.registerEvents();
    await this.initializeWithRetry();
  }

  private async destroyAfterFailure(): Promise<void> {
    try {
      await this.client.destroy();
    } catch (error) {
      this.logger.log('WhatsApp destroy after failed initialize failed', {
        error: (error as Error).message,
      });
    }
  }

  private async cleanupBrowserProcesses(): Promise<void> {
    if (!this.clientFactory.cleanupBrowserProcesses) {
      this.logger.log(
        'No browser cleanup hook configured for WhatsApp client factory',
      );
      return;
    }

    const killedCount = await this.clientFactory.cleanupBrowserProcesses();
    this.logger.log('WhatsApp browser cleanup hook completed', { killedCount });
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
