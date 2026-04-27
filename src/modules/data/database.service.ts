import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Database.Database;

  onModuleInit(): void {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    this.db = new Database(join(dataDir, 'bugmate.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.migrate();
    this.logger.log('Operational SQLite database initialized');
  }

  get connection(): Database.Database {
    if (!this.db) {
      this.onModuleInit();
    }
    return this.db;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        phone TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        systems_json TEXT NOT NULL DEFAULT '[]',
        knowledge_docs_json TEXT NOT NULL DEFAULT '[]',
        trello_lists_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opt_outs (
        phone TEXT PRIMARY KEY,
        reason TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS campaign_runs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        totals_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS campaign_jobs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        name TEXT,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        message TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(run_id) REFERENCES campaign_runs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_campaign_jobs_run_status
        ON campaign_jobs(run_id, status);
    `);
  }
}
