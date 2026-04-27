import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OptOutService } from './opt-out.service';

@Controller('api/opt-outs')
export class OptOutController {
  constructor(private readonly optOutService: OptOutService) {}

  @Get()
  list() {
    return this.optOutService.list();
  }

  @Post()
  add(@Body() body: { phone: string; reason?: string; source?: string }) {
    return this.optOutService.add(body.phone, body.reason, body.source ?? 'manual');
  }

  @Delete(':phone')
  remove(@Param('phone') phone: string) {
    return { ok: this.optOutService.remove(phone) };
  }
}
