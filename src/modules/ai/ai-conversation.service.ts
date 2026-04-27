import { Inject, Injectable } from '@nestjs/common';
import type { AIGenerateRequest, AIGenerateResponse, AIProvider } from '../core/interfaces/ai-provider.interface';
import { AI_PROVIDER } from '../core/tokens/injection-tokens';
import { ConfigLoaderService } from '../config/config-loader.service';
import { RagContextService, type RagCitation } from './rag-context.service';

export interface AiConversationRequest extends Omit<AIGenerateRequest, 'systemPrompt'> {
  systemPrompt?: string;
  useKnowledge?: boolean;
  allowedSources?: string[];
  ragContextInstruction?: string;
}

export interface AiConversationResponse extends AIGenerateResponse {
  rag: {
    used: boolean;
    citations: RagCitation[];
  };
}

@Injectable()
export class AiConversationService {
  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly configLoader: ConfigLoaderService,
    private readonly ragContext: RagContextService,
  ) {}

  async generateResponse(request: AiConversationRequest): Promise<AiConversationResponse> {
    const baseSystemPrompt = this.resolveSystemPrompt(request.systemPrompt);
    const rag = request.useKnowledge
      ? await this.ragContext.buildContext({
          query: request.prompt,
          allowedSources: request.allowedSources,
          maxResults: this.configLoader.botConfig.ai.ragTopK,
          instruction: request.ragContextInstruction,
        })
      : { found: false, promptSection: '', citations: [] };

    const systemPrompt = rag.found ? `${baseSystemPrompt}\n\n${rag.promptSection}` : baseSystemPrompt;

    const response = await this.aiProvider.generate({
      ...request,
      systemPrompt,
      history: this.limitHistory(request.history),
    });

    return {
      ...response,
      rag: {
        used: rag.found,
        citations: rag.citations,
      },
    };
  }

  async generate(request: AiConversationRequest): Promise<AiConversationResponse> {
    return this.generateResponse(request);
  }

  private resolveSystemPrompt(systemPrompt?: string): string {
    if (systemPrompt) return systemPrompt;

    const { ai, identity } = this.configLoader.botConfig;
    return this.configLoader.interpolate(ai.systemPrompt, {
      company: identity.company,
      developerName: identity.developerName,
      botName: identity.name,
      tone: identity.tone,
    });
  }

  private limitHistory(history: AIGenerateRequest['history']): AIGenerateRequest['history'] {
    const maxHistoryMessages = this.configLoader.botConfig.ai.maxHistoryMessages;
    if (!history || maxHistoryMessages <= 0) {
      return history;
    }
    return history.slice(-maxHistoryMessages);
  }
}
