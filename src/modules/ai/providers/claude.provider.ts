import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { AIProvider, AIGenerateRequest, AIGenerateResponse } from '../../core/interfaces/ai-provider.interface';
import { BotConfigService } from '../../config/bot-config.service';
import { ConfigLoaderService } from '../../config/config-loader.service';

type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

@Injectable()
export class ClaudeProvider implements AIProvider, OnModuleInit {
  readonly providerName = 'Claude';
  private readonly logger = new Logger(ClaudeProvider.name);
  private client?: Anthropic;

  constructor(
    private readonly botConfig: BotConfigService,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  onModuleInit(): void {
    if (this.botConfig.aiProvider === 'claude') {
      this.client = new Anthropic({
        apiKey: this.requireApiKey(),
        maxRetries: 2,
        timeout: this.botConfig.anthropicTimeoutMs,
      });
    }
    this.logger.log(`Claude initialized — model: ${this.botConfig.anthropicModel}`);
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const { ai, identity } = this.configLoader.botConfig;

    const systemPrompt =
      request.systemPrompt ??
      this.configLoader.interpolate(ai.systemPrompt, {
        company: identity.company,
        developerName: identity.developerName,
        botName: identity.name,
        tone: identity.tone,
      });

    // Build the current user message content
    const userContent: ClaudeContentBlock[] = [];
    if (request.imageBase64 && request.imageMimeType) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: request.imageMimeType, data: request.imageBase64 },
      });
    }
    userContent.push({ type: 'text', text: request.prompt });

    // Build messages array: history + current turn
    const messages: Anthropic.MessageParam[] = [
      ...(request.history ?? []).map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user' as const,
        content: userContent.length === 1 && userContent[0].type === 'text'
          ? userContent[0].text
          : userContent as Anthropic.ContentBlockParam[],
      },
    ];

    const startedAt = Date.now();
    this.logger.debug(
      `Claude generate — model=${this.botConfig.anthropicModel} promptChars=${request.prompt.length} ` +
        `history=${request.history?.length ?? 0} image=${!!request.imageBase64}`,
    );

    try {
      const message = await this.getClient().messages.create({
        model: this.botConfig.anthropicModel,
        max_tokens: this.botConfig.anthropicMaxTokens,
        system: systemPrompt,
        messages,
      });

      const textBlock = message.content.find((b) => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '';

      this.logger.log(
        `Claude generate success — model=${message.model} ` +
          `ms=${Date.now() - startedAt} chars=${text.length} ` +
          `in=${message.usage.input_tokens} out=${message.usage.output_tokens}`,
      );

      return {
        text,
        metadata: {
          model: message.model,
          usage: {
            input_tokens: message.usage.input_tokens,
            output_tokens: message.usage.output_tokens,
          },
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Claude generate failed after ${Date.now() - startedAt}ms: ${err.message}`);
      throw new Error(`AI provider error: ${err.message}`);
    }
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.requireApiKey(),
        maxRetries: 2,
        timeout: this.botConfig.anthropicTimeoutMs,
      });
    }
    return this.client;
  }

  private requireApiKey(): string {
    const key = this.botConfig.anthropicApiKey;
    if (!key) throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
    return key;
  }
}
