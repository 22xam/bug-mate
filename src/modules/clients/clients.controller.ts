import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { ClientConfig } from '../config/types/bot-config.types';
import { ClientsService } from './clients.service';

@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':phone')
  findOne(@Param('phone') phone: string) {
    return this.clientsService.findByPhone(phone);
  }

  @Post()
  create(@Body() body: ClientConfig) {
    return this.clientsService.upsert(body);
  }

  @Patch(':phone')
  update(@Param('phone') phone: string, @Body() body: Partial<ClientConfig>) {
    const current = this.clientsService.findByPhone(phone);
    const merged = {
      phone,
      name: body.name ?? current?.name ?? '',
      company: body.company ?? current?.company ?? '',
      systems: body.systems ?? current?.systems ?? [],
      knowledgeDocs: body.knowledgeDocs ?? current?.knowledgeDocs ?? [],
      trelloLists: body.trelloLists ?? current?.trelloLists ?? {},
      notes: body.notes ?? current?.notes,
    };
    return this.clientsService.upsert(merged);
  }

  @Delete(':phone')
  delete(@Param('phone') phone: string) {
    return { ok: this.clientsService.delete(phone) };
  }

  @Post('import/preview')
  importPreview(@Body() body: { clients: ClientConfig[] }) {
    return this.clientsService.importPreview(body.clients ?? []);
  }

  @Post('import/commit')
  importCommit(@Body() body: { clients: ClientConfig[] }) {
    return this.clientsService.importCommit(body.clients ?? []);
  }
}
