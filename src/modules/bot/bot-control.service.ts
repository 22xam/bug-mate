import { Injectable, Logger } from '@nestjs/common';

/**
 * Centralized service that manages which senders have the bot paused.
 * Used by WhatsAppAdapter (dev manual takeover) and ApiController (CLI control).
 */
@Injectable()
export class BotControlService {
  private readonly logger = new Logger(BotControlService.name);
  private readonly pausedSenders = new Set<string>();

  /** Pause the bot for a sender. Returns true if it was newly paused. */
  pause(senderId: string): boolean {
    const isNew = !this.pausedSenders.has(senderId);
    this.pausedSenders.add(senderId);
    if (isNew) {
      this.logger.log(`Bot paused for ${senderId}`);
    }
    return isNew;
  }

  /** Resume the bot for a sender. Returns true if it was actually paused. */
  resume(senderId: string): boolean {
    const existed = this.pausedSenders.has(senderId);
    this.pausedSenders.delete(senderId);
    if (existed) {
      this.logger.log(`Bot resumed for ${senderId}`);
    }
    return existed;
  }

  isPaused(senderId: string): boolean {
    return this.pausedSenders.has(senderId);
  }

  getPausedSenders(): string[] {
    return [...this.pausedSenders];
  }
}
