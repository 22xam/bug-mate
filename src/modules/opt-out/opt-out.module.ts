import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module';
import { OptOutController } from './opt-out.controller';
import { OptOutService } from './opt-out.service';

@Module({
  imports: [DataModule],
  controllers: [OptOutController],
  providers: [OptOutService],
  exports: [OptOutService],
})
export class OptOutModule {}
