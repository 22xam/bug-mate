// Fix TLS certificate issues on Windows with Node.js native fetch
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { runStartupSelector } from './startup-selector';
import { LogBufferService } from './modules/api/log-buffer.service';

const processLogger = new Logger('Process');

function printPanelReady(port: string | number): void {
  process.stdout.write(`\nPanel disponible: http://127.0.0.1:${port}/panel\n\n`);
}

function isWhatsAppSessionClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? '' : '';
  return (
    /Execution context was destroyed|Target closed|Protocol error|Navigation/i.test(message) ||
    /whatsapp-web\.js[\\/]src[\\/]Client\.js/i.test(stack)
  );
}

function logWhatsAppSessionClosed(error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  const message =
    'Sesion de WhatsApp cerrada desde el celular o navegador. ' +
    'El bot quedo sin conexion: reinicia el bot y escanea el QR nuevamente.';
  processLogger.error(`${message} Detalle: ${detail}`, error instanceof Error ? error.stack : undefined);
  process.stdout.write(`\n${message}\n\n`);
}

process.on('uncaughtException', (error) => {
  if (isWhatsAppSessionClosedError(error)) {
    logWhatsAppSessionClosed(error);
    return;
  }

  processLogger.error(`Uncaught exception: ${error.message}`, error.stack);
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  if (isWhatsAppSessionClosedError(reason)) {
    logWhatsAppSessionClosed(reason);
    return;
  }

  processLogger.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

async function bootstrap() {
  const startupMode = await runStartupSelector();
  if (startupMode === 'mcp') {
    return;
  }

  // Create the app normally; LogBufferService is injected via DI into the controller.
  // We also set it as the Nest logger so every LOG/ERROR/WARN/DEBUG line is captured.
  const app = await NestFactory.create(AppModule);
  const logSvc = app.get(LogBufferService);
  app.useLogger(logSvc);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  printPanelReady(port);
  new Logger('Bootstrap').log(`**** BOT-Oscar is running on port ${port} ***`);
}
bootstrap();
