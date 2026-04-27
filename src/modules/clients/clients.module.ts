import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { DataModule } from '../data/data.module';
import { ClientsController } from './clients.controller';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';

@Module({
  imports: [AppConfigModule, DataModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService],
  exports: [ClientsRepository, ClientsService],
})
export class ClientsModule {}
