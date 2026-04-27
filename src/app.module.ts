import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/config.module';
import { CoreModule } from './modules/core/core.module';
import { AiModule } from './modules/ai/ai.module';
import { SessionModule } from './modules/session/session.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { BotModule } from './modules/bot/bot.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ApiModule } from './modules/api/api.module';
import { DataModule } from './modules/data/data.module';
import { ClientsModule } from './modules/clients/clients.module';
import { OptOutModule } from './modules/opt-out/opt-out.module';
import { CampaignModule } from './modules/campaign/campaign.module';

@Module({
  imports: [
    AppConfigModule,   // env + BotConfigService + ConfigLoaderService
    DataModule,        // operational SQLite database
    CoreModule,        // OllamaProcessService (skipped if OLLAMA_AUTO_START=false)
    AiModule,          // GeminiProvider
    ClientsModule,     // client CRUD and DB seed
    OptOutModule,      // campaign opt-out list
    CampaignModule,    // campaign preview/runs
    SessionModule,     // in-memory conversation state
    KnowledgeModule,   // FAQ + RAG with SQLite
    BotModule,         // BotService + BotControlService
    MessagingModule,   // WhatsAppAdapter
    ApiModule,         // REST API for CLI control
  ],
})
export class AppModule {}
