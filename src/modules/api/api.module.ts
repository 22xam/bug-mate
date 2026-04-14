import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { AppConfigModule } from '../config/config.module';
import { SessionModule } from '../session/session.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { BotModule } from '../bot/bot.module';
import { TrelloModule } from '../trello/trello.module';

@Module({
  imports: [AppConfigModule, SessionModule, KnowledgeModule, BotModule, TrelloModule],
  controllers: [ApiController],
})
export class ApiModule {}
