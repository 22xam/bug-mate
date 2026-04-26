import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AIProvider, AIGenerateRequest, AIGenerateResponse, EmbeddingProvider } from '../../core/interfaces/ai-provider.interface';
import { BotConfigService } from '../../config/bot-config.service';
import { ConfigLoaderService } from '../../config/config-loader.service';

type OpenRouterRole = 'system' | 'user' | 'assistant';

interface OpenRouterTextContent {
  type: 'text';
  text: string;
}

interface OpenRouterImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

type OpenRouterMessageContent = string | Array<OpenRouterTextContent | OpenRouterImageContent>;

interface OpenRouterMessage {
  role: OpenRouterRole;
  content: OpenRouterMessageContent;
}

interface OpenRouterChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  usage?: Record<string, unknown>;
}

interface OpenRouterEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
  model?: string;
  usage?: Record<string, unknown>;
}

export interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
  };
  pricing?: Record<string, string>;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

@Injectable()
export class OpenRouterProvider implements AIProvider, EmbeddingProvider {
  readonly providerName = 'OpenRouter';
  private readonly logger = new Logger(OpenRouterProvider.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly botConfig: BotConfigService,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const { ai, identity } = this.configLoader.botConfig;
    const model = ai.model;

    const systemPrompt =
      request.systemPrompt ??
      this.configLoader.interpolate(ai.systemPrompt, {
        company: identity.company,
        developerName: identity.developerName,
        botName: identity.name,
        tone: identity.tone,
      });

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(request.history ?? []).map((h) => ({
        role: h.role,
        content: h.content,
      })),
      {
        role: 'user',
        content: this.buildUserContent(request),
      },
    ];

    this.logger.debug(`Sending prompt to OpenRouter model "${model}"`);

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<OpenRouterChatResponse>(
          `${this.botConfig.openRouterBaseUrl}/chat/completions`,
          {
            model,
            messages,
          },
          { headers: this.headers() },
        ),
      );

      return {
        text: this.extractText(data),
        metadata: {
          id: data.id,
          model: data.model ?? model,
          usage: data.usage,
        },
      };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Unknown error';
      this.logger.error(`OpenRouter generation failed: ${msg}`);
      throw new Error(`AI provider error: ${msg}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    const { ai } = this.configLoader.botConfig;
    const body: Record<string, unknown> = {
      model: ai.embeddingModel,
      input: text,
    };

    if (this.botConfig.openRouterEmbeddingDimensions) {
      body.dimensions = this.botConfig.openRouterEmbeddingDimensions;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<OpenRouterEmbeddingResponse>(
          `${this.botConfig.openRouterBaseUrl}/embeddings`,
          body,
          { headers: this.headers() },
        ),
      );

      const embedding = data.data?.[0]?.embedding;
      if (!embedding) {
        throw new Error('OpenRouter returned no embedding vector');
      }
      return embedding;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Unknown error';
      this.logger.error(`OpenRouter embedding failed: ${msg}`);
      throw new Error(`Embedding error: ${msg}`);
    }
  }

  async listModels(outputModalities = 'text'): Promise<OpenRouterModel[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<OpenRouterModelsResponse>(
        `${this.botConfig.openRouterBaseUrl}/models`,
        {
          headers: this.headers(Boolean(this.botConfig.openRouterApiKeyOptional)),
          params: { output_modalities: outputModalities },
        },
      ),
    );
    return data.data ?? [];
  }

  async listChatModels(): Promise<OpenRouterModel[]> {
    const models = await this.listModels('text');
    return models.filter((model) => {
      const output = model.architecture?.output_modalities ?? [];
      return output.length === 0 || output.includes('text');
    });
  }

  async listEmbeddingModels(): Promise<OpenRouterModel[]> {
    const models = await this.listModels('embeddings');
    return models.filter((model) => {
      const output = model.architecture?.output_modalities ?? [];
      return output.includes('embedding') || output.includes('embeddings');
    });
  }

  private buildUserContent(request: AIGenerateRequest): OpenRouterMessageContent {
    if (!request.imageBase64 || !request.imageMimeType) {
      return request.prompt;
    }

    return [
      { type: 'text', text: request.prompt },
      {
        type: 'image_url',
        image_url: {
          url: `data:${request.imageMimeType};base64,${request.imageBase64}`,
        },
      },
    ];
  }

  private extractText(data: OpenRouterChatResponse): string {
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((part) => part.text ?? '').join('');
    }
    return '';
  }

  private headers(includeAuth = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Title': this.botConfig.openRouterAppName,
    };

    if (includeAuth) {
      headers.Authorization = `Bearer ${this.botConfig.openRouterApiKey}`;
    }

    if (this.botConfig.openRouterSiteUrl) {
      headers['HTTP-Referer'] = this.botConfig.openRouterSiteUrl;
    }

    return headers;
  }
}
