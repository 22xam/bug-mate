import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  CreateOptOutInput,
  OptOutEvent,
  OptOutRecord,
  UpdateOptOutInput,
} from './opt-out.types';

interface DatabaseServiceLike {
  getDatabase?: (name?: string) => Database.Database;
  getConnection?: (name?: string) => Database.Database;
  db?: Database.Database;
}

interface OptOutRow {
  phone: string;
  recipient_id: string;
  source: string;
  reason: string | null;
  keyword: string | null;
  created_at: string;
  updated_at: string;
}

interface OptOutEventRow {
  id: string;
  phone: string;
  recipient_id: string;
  keyword: string | null;
  message: string | null;
  action: OptOutEvent['action'];
  metadata_json: string | null;
  created_at: string;
}

@Injectable()
export class OptOutRepository implements OnModuleInit {
  private readonly logger = new Logger(OptOutRepository.name);
  private db: Database.Database;

  constructor(
    @Optional()
    @Inject('DatabaseService')
    private readonly databaseService?: DatabaseServiceLike,
  ) {}

  onModuleInit(): void {
    this.db = this.resolveDatabase();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS opt_outs (
        phone TEXT PRIMARY KEY,
        recipient_id TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        reason TEXT,
        keyword TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opt_out_events (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        keyword TEXT,
        message TEXT,
        action TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_opt_out_events_phone ON opt_out_events(phone);
      CREATE INDEX IF NOT EXISTS idx_opt_out_events_created_at ON opt_out_events(created_at);
    `);
    this.logger.log('Opt-out SQLite tables initialized');
  }

  list(): OptOutRecord[] {
    const rows = this.db.prepare('SELECT * FROM opt_outs ORDER BY updated_at DESC').all() as OptOutRow[];
    return rows.map((row) => this.mapRecord(row));
  }

  get(phoneOrRecipientId: string): OptOutRecord | null {
    const normalized = this.normalizePhone(phoneOrRecipientId);
    const row = this.db
      .prepare('SELECT * FROM opt_outs WHERE phone = ? OR recipient_id = ?')
      .get(normalized, this.toRecipientId(phoneOrRecipientId)) as OptOutRow | undefined;
    return row ? this.mapRecord(row) : null;
  }

  upsert(input: CreateOptOutInput): OptOutRecord {
    const now = new Date().toISOString();
    const phone = this.normalizePhone(input.phone || input.recipientId || '');
    const recipientId = input.recipientId ?? this.toRecipientId(phone);
    const existing = this.get(phone);

    this.db
      .prepare(
        `
        INSERT INTO opt_outs (phone, recipient_id, source, reason, keyword, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET
          recipient_id = excluded.recipient_id,
          source = excluded.source,
          reason = excluded.reason,
          keyword = excluded.keyword,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        phone,
        recipientId,
        input.source ?? 'unknown',
        input.reason ?? null,
        input.keyword ?? null,
        existing?.createdAt ?? now,
        now,
      );

    const saved = this.get(phone);
    if (!saved) throw new Error(`Failed to persist opt-out for ${phone}`);
    this.addEvent({
      phone,
      recipientId,
      keyword: input.keyword,
      message: input.reason,
      action: existing ? 'updated' : 'created',
    });
    return saved;
  }

  update(phoneOrRecipientId: string, input: UpdateOptOutInput): OptOutRecord | null {
    const existing = this.get(phoneOrRecipientId);
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE opt_outs
        SET source = COALESCE(?, source),
            reason = ?,
            keyword = ?,
            updated_at = ?
        WHERE phone = ?
      `,
      )
      .run(
        input.source ?? null,
        input.reason === undefined ? existing.reason ?? null : input.reason,
        input.keyword === undefined ? existing.keyword ?? null : input.keyword,
        now,
        existing.phone,
      );

    this.addEvent({
      phone: existing.phone,
      recipientId: existing.recipientId,
      keyword: input.keyword ?? existing.keyword,
      message: input.reason ?? existing.reason,
      action: 'updated',
    });
    return this.get(existing.phone);
  }

  remove(phoneOrRecipientId: string): boolean {
    const existing = this.get(phoneOrRecipientId);
    if (!existing) return false;

    const result = this.db.prepare('DELETE FROM opt_outs WHERE phone = ?').run(existing.phone);
    if (result.changes > 0) {
      this.addEvent({
        phone: existing.phone,
        recipientId: existing.recipientId,
        keyword: existing.keyword,
        message: existing.reason,
        action: 'removed',
      });
      return true;
    }
    return false;
  }

  addEvent(input: {
    phone: string;
    recipientId?: string;
    keyword?: string;
    message?: string;
    action: OptOutEvent['action'];
    metadata?: Record<string, unknown>;
  }): OptOutEvent {
    const event: OptOutEvent = {
      id: randomUUID(),
      phone: this.normalizePhone(input.phone),
      recipientId: input.recipientId ?? this.toRecipientId(input.phone),
      keyword: input.keyword,
      message: input.message,
      action: input.action,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `
        INSERT INTO opt_out_events
          (id, phone, recipient_id, keyword, message, action, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        event.id,
        event.phone,
        event.recipientId,
        event.keyword ?? null,
        event.message ?? null,
        event.action,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.createdAt,
      );
    return event;
  }

  listEvents(phoneOrRecipientId?: string): OptOutEvent[] {
    const rows = phoneOrRecipientId
      ? (this.db
          .prepare('SELECT * FROM opt_out_events WHERE phone = ? ORDER BY created_at DESC')
          .all(this.normalizePhone(phoneOrRecipientId)) as OptOutEventRow[])
      : (this.db
          .prepare('SELECT * FROM opt_out_events ORDER BY created_at DESC')
          .all() as OptOutEventRow[]);
    return rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      recipientId: row.recipient_id,
      keyword: row.keyword ?? undefined,
      message: row.message ?? undefined,
      action: row.action,
      metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
    }));
  }

  private resolveDatabase(): Database.Database {
    const shared =
      this.databaseService?.getDatabase?.('campaigns.sqlite') ??
      this.databaseService?.getConnection?.('campaigns.sqlite') ??
      this.databaseService?.db;

    if (shared) return shared;

    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    return new Database(join(dataDir, 'campaigns.sqlite'));
  }

  private mapRecord(row: OptOutRow): OptOutRecord {
    return {
      phone: row.phone,
      recipientId: row.recipient_id,
      source: row.source as OptOutRecord['source'],
      reason: row.reason ?? undefined,
      keyword: row.keyword ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private normalizePhone(value: string): string {
    return value.replace(/\D/g, '');
  }

  private toRecipientId(value: string): string {
    return value.includes('@') ? value : `${this.normalizePhone(value)}@c.us`;
  }
}
