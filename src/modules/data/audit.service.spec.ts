import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuditService } from './audit.service';
import { DatabaseService } from './database.service';

describe('AuditService', () => {
  const originalEnv = process.env;
  let tempDir: string;
  let database: DatabaseService;
  let audit: AuditService;

  beforeEach(() => {
    process.env = { ...originalEnv };
    tempDir = mkdtempSync(join(tmpdir(), 'bot-oscar-audit-'));
    process.env.BOT_OSCAR_DB_PATH = join(tempDir, 'bugmate.sqlite');
    database = new DatabaseService();
    database.onModuleInit();
    audit = new AuditService(database);
  });

  afterEach(() => {
    database.connection.close();
    rmSync(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('records and lists audit events newest first', () => {
    const first = audit.record({
      entityType: 'client',
      entityId: '5491111111111',
      action: 'created',
      source: 'test',
      metadata: { name: 'Uno' },
    });
    const second = audit.record({
      entityType: 'campaign_run',
      entityId: 'run-1',
      action: 'paused',
      source: 'test',
    });

    const events = audit.list();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: second.id,
      entityType: 'campaign_run',
      entityId: 'run-1',
      action: 'paused',
      metadata: {},
    });
    expect(events[1]).toMatchObject({
      id: first.id,
      entityType: 'client',
      metadata: { name: 'Uno' },
    });
  });

  it('creates the operational database at bugmate.sqlite by default path override', () => {
    expect(database.connection.prepare("SELECT name FROM sqlite_master WHERE name = 'audit_events'").get()).toBeTruthy();
  });
});
