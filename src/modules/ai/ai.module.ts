import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { AiConversationService } from './ai-conversation.service';
import { RagContextService } from './rag-context.service';
import { AI_PROVIDER, EMBEDDING_PROVIDER } from '../core/tokens/injection-tokens';
import { AppConfigModule } from '../config/config.module';
import { BotConfigService } from '../config/bot-config.service';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [HttpModule, AppConfigModule, SessionModule],
  providers: [
    GeminiProvider,
    OllamaProvider,
    OpenRouterProvider,
    ClaudeProvider,
    RagContextService,
    AiConversationService,
    {
      provide: AI_PROVIDER,
      inject: [BotConfigService, GeminiProvider, OllamaProvider, OpenRouterProvider, ClaudeProvider],
      useFactory: (
        config: BotConfigService,
        gemini: GeminiProvider,
        ollama: OllamaProvider,
        openRouter: OpenRouterProvider,
        claude: ClaudeProvider,
      ) => {
        if (config.aiProvider === 'ollama') return ollama;
        if (config.aiProvider === 'openrouter') return openRouter;
        if (config.aiProvider === 'claude') return claude;
        return gemini;
      },
    },
    {
      provide: EMBEDDING_PROVIDER,
      inject: [BotConfigService, GeminiProvider, OllamaProvider, OpenRouterProvider],
      useFactory: (
        config: BotConfigService,
        gemini: GeminiProvider,
        ollama: OllamaProvider,
        openRouter: OpenRouterProvider,
      ) => {
        if (config.aiProvider === 'ollama') return ollama;
        // OpenRouter y Claude no tienen endpoint de embeddings — usar Gemini para vectores
        return gemini;
      },
    },
  ],
  exports: [
    AI_PROVIDER,
    EMBEDDING_PROVIDER,
    GeminiProvider,
    OllamaProvider,
    OpenRouterProvider,
    ClaudeProvider,
    RagContextService,
    AiConversationService,
  ],
})
export class AiModule {}
