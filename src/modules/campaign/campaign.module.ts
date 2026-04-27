import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AppConfigModule } from '../config/config.module';
import { ClientsModule } from '../clients/clients.module';
import { DataModule } from '../data/data.module';
import { MessagingModule } from '../messaging/messaging.module';
import { OptOutModule } from '../opt-out/opt-out.module';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';

@Module({
  imports: [AiModule, AppConfigModule, ClientsModule, DataModule, OptOutModule, MessagingModule],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
