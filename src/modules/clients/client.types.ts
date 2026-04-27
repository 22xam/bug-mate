import type { ClientConfig } from '../config/types/bot-config.types';

export interface ClientRecord extends ClientConfig {
  id: number;
  normalizedPhone: string;
  source: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastImportedAt?: string;
}

export interface ClientRow {
  id: number;
  phone: string;
  normalized_phone: string;
  name: string;
  company: string;
  systems_json: string;
  notes: string | null;
  knowledge_docs_json: string;
  trello_lists_json: string;
  source: string;
  active: number;
  created_at: string;
  updated_at: string;
  last_imported_at: string | null;
}

export type CreateClientDto = ClientConfig & {
  source?: string;
  active?: boolean;
};

export type UpdateClientDto = Partial<ClientConfig> & {
  source?: string;
  active?: boolean;
};

export interface ClientListOptions {
  includeInactive?: boolean;
  search?: string;
}

export interface ClientImportResult {
  total: number;
  inserted: number;
  updated: number;
}
