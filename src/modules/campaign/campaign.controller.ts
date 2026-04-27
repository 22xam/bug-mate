import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CampaignService } from './campaign.service';

@Controller('api')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get('campaigns')
  listCampaigns() {
    return this.campaignService.listCampaigns();
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.campaignService.getCampaign(id);
  }

  @Post('campaigns/:id/preview')
  preview(@Param('id') id: string, @Body() body: { phones?: string[]; limit?: number }): Promise<unknown> {
    return this.campaignService.preview(id, body?.phones, body?.limit ?? 10);
  }

  @Post('campaigns/:id/runs')
  createRun(@Param('id') id: string, @Body() body: { phones?: string[]; dryRun?: boolean }) {
    return this.campaignService.createRun(id, body?.phones, body?.dryRun ?? false);
  }

  @Post('campaign-runs')
  createRunCompat(@Body() body: { campaignId: string; phones?: string[]; dryRun?: boolean }) {
    return this.campaignService.createRun(body.campaignId, body?.phones, body?.dryRun ?? false);
  }

  @Get('campaign-runs')
  listRuns() {
    return this.campaignService.listRuns();
  }

  @Get('campaign-runs/:id')
  getRun(@Param('id') id: string) {
    return this.campaignService.getRun(id);
  }

  @Post('campaign-runs/:id/pause')
  pauseRun(@Param('id') id: string) {
    return this.campaignService.setRunStatus(id, 'paused');
  }

  @Post('campaign-runs/:id/resume')
  resumeRun(@Param('id') id: string) {
    return this.campaignService.setRunStatus(id, 'queued');
  }

  @Post('campaign-runs/:id/cancel')
  cancelRun(@Param('id') id: string) {
    return this.campaignService.setRunStatus(id, 'cancelled');
  }

  @Post('campaign-runs/:id/process-next')
  processNext(@Param('id') id: string) {
    return this.campaignService.processNextQueuedJob(id);
  }
}
