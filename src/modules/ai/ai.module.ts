import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { AI_PROVIDER, EMBEDDING_PROVIDER } from '../core/tokens/injection-tokens';
import { AppConfigModule } from '../config/config.module';
import { BotConfigService } from '../config/bot-config.service';

@Module({
  imports: [HttpModule, AppConfigModule],
  providers: [
    GeminiProvider,
    OllamaProvider,
    OpenRouterProvider,
    {
      provide: AI_PROVIDER,
      inject: [BotConfigService, GeminiProvider, OllamaProvider, OpenRouterProvider],
      useFactory: (
        config: BotConfigService,
        gemini: GeminiProvider,
        ollama: OllamaProvider,
        openRouter: OpenRouterProvider,
      ) => {
        if (config.aiProvider === 'ollama') return ollama;
        if (config.aiProvider === 'openrouter') return openRouter;
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
        // OpenRouter chat models don't support embeddings — fall back to Gemini for vectors
        if (config.aiProvider === 'openrouter') return gemini;
        return gemini;
      },
    },
  ],
  exports: [AI_PROVIDER, EMBEDDING_PROVIDER, GeminiProvider, OllamaProvider, OpenRouterProvider],
})
export class AiModule {}
