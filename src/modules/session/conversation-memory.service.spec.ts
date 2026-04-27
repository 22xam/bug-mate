import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../data/database.service';
import { ConversationMemoryService } from './conversation-memory.service';

describe('ConversationMemoryService', () => {
  const originalEnv = process.env;
  let tempDir: string;
  let database: DatabaseService;
  let memory: ConversationMemoryService;

  beforeEach(() => {
    process.env = { ...originalEnv };
    tempDir = mkdtempSync(join(tmpdir(), 'bot-oscar-memory-'));
    process.env.BOT_OSCAR_DB_PATH = join(tempDir, 'bugmate.sqlite');
    database = new DatabaseService();
    database.onModuleInit();
    memory = new ConversationMemoryService(database);
  });

  afterEach(() => {
    database.connection.close();
    rmSync(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('records messages and returns recent context in chronological order', () => {
    memory.record('5491@c.us', 'user', 'hola');
    memory.record('5491@c.us', 'assistant', 'buenas');
    memory.record('5491@c.us', 'user', 'necesito soporte');

    const context = memory.getContext('5491@c.us', 2);

    expect(context.unsummarizedCount).toBe(3);
    expect(context.recentMessages).toEqual([
      { role: 'assistant', content: 'buenas' },
      { role: 'user', content: 'necesito soporte' },
    ]);
  });

  it('saves a summary and marks messages as summarized', () => {
    memory.record('5491@c.us', 'user', 'problema con facturacion');

    memory.saveSummary('5491@c.us', 'El cliente tiene un problema con facturacion.', 1);
    const context = memory.getContext('5491@c.us', 5);

    expect(context.summary).toBe('El cliente tiene un problema con facturacion.');
    expect(context.unsummarizedCount).toBe(0);
  });
});
