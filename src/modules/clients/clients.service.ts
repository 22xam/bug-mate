import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigLoaderService } from '../config/config-loader.service';
import type { ClientConfig } from '../config/types/bot-config.types';
import { ClientsRepository } from './clients.repository';

@Injectable()
export class ClientsService implements OnModuleInit {
  constructor(
    private readonly repository: ClientsRepository,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  onModuleInit(): void {
    if (this.repository.count() === 0) {
      this.repository.seed(this.configLoader.clients);
    }
  }

  findAll(): ClientConfig[] {
    return this.repository.findAll();
  }

  findByPhone(phone: string): ClientConfig | null {
    return this.repository.findByPhone(phone);
  }

  upsert(client: ClientConfig): ClientConfig {
    return this.repository.upsert(client);
  }

  delete(phone: string): boolean {
    return this.repository.delete(phone);
  }

  importPreview(clients: ClientConfig[]) {
    const existing = new Set(this.findAll().map((c) => c.phone));
    return clients.map((client) => {
      const phone = this.repository.normalizePhone(client.phone);
      return {
        phone,
        name: client.name,
        valid: Boolean(phone && client.name),
        action: existing.has(phone) ? 'update' : 'create',
      };
    });
  }

  importCommit(clients: ClientConfig[]) {
    const results = clients.map((client) => this.upsert(client));
    return { imported: results.length, clients: results };
  }
}
