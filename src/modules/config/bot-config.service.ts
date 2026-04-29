import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typed access to .env secrets and infrastructure config.
 * Bot behavior config (prompts, menus, flows, etc.) lives in ConfigLoaderService.
 */
@Injectable()
export class BotConfigService {
  constructor(private readonly config: ConfigService) {}

  get port(): number {
    return this.config.get<number>('PORT', 3000);
  }

  get geminiApiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY');
  }

  get ollamaUrl(): string {
    return this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
  }

  get ollamaModel(): string {
    return this.config.get<string>('OLLAMA_MODEL', 'qwen3:8b');
  }

  get ollamaAutoStart(): boolean {
    return this.config.get<string>('OLLAMA_AUTO_START', 'false') === 'true';
  }

  get developerName(): string {
    return this.config.getOrThrow<string>('DEVELOPER_NAME');
  }

  get developerWhatsAppId(): string {
    const phone = this.config.getOrThrow<string>('DEVELOPER_PHONE');
    return `${phone}@c.us`;
  }

  get controlGroupId(): string | null {
    return this.config.get<string>('CONTROL_GROUP_ID') ?? null;
  }

  get openRouterApiKey(): string {
    return this.config.getOrThrow<string>('OPENROUTER_API_KEY');
  }

  get openRouterApiKeyOptional(): string | undefined {
    return this.config.get<string>('OPENROUTER_API_KEY') || undefined;
  }

  get openRouterBaseUrl(): string {
    return this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/+$/, '');
  }

  get openRouterSiteUrl(): string | undefined {
    return this.config.get<string>('OPENROUTER_SITE_URL') || undefined;
  }

  get openRouterAppName(): string {
    return this.config.get<string>('OPENROUTER_APP_NAME', 'BOT-Oscar');
  }

  get openRouterEmbeddingDimensions(): number | undefined {
    const value = this.config.get<string>('OPENROUTER_EMBEDDING_DIMENSIONS');
    return value ? Number(value) : undefined;
  }

  get openRouterTimeoutMs(): number {
    return Number(this.config.get<number>('OPENROUTER_TIMEOUT_MS', 60000));
  }

  get openRouterRaceModels(): boolean {
    const value = this.config.get<boolean | string>('OPENROUTER_RACE_MODELS', true);
    return value === true || value === 'true';
  }

  get aiProvider(): 'gemini' | 'ollama' | 'openrouter' | 'claude' {
    return this.config.get<'gemini' | 'ollama' | 'openrouter' | 'claude'>('AI_PROVIDER', 'gemini');
  }

  get anthropicApiKey(): string | undefined {
    return this.config.get<string>('ANTHROPIC_API_KEY');
  }

  get anthropicModel(): string {
    return this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-4-6');
  }

  get anthropicMaxTokens(): number {
    return Number(this.config.get('ANTHROPIC_MAX_TOKENS', 1024));
  }

  get anthropicTimeoutMs(): number {
    return Number(this.config.get('ANTHROPIC_TIMEOUT_MS', 60000));
  }

  get trelloEnabled(): boolean {
    return !!(this.config.get<string>('TRELLO_API_KEY') && this.config.get<string>('TRELLO_TOKEN'));
  }

  get trelloApiKey(): string {
    return this.config.getOrThrow<string>('TRELLO_API_KEY');
  }

  get trelloToken(): string {
    return this.config.getOrThrow<string>('TRELLO_TOKEN');
  }
}
