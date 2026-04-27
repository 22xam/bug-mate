import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AiConversationService } from './ai-conversation.service';
import { ConversationMemoryService } from '../session/conversation-memory.service';
import { DatabaseService } from '../data/database.service';

describe('AiConversationService memory', () => {
  const originalEnv = process.env;
  let tempDir: string;
  let database: DatabaseService;
  let memory: ConversationMemoryService;
  let aiProvider: { providerName: string; generate: jest.Mock };
  let service: AiConversationService;

  const configLoader = {
    botConfig: {
      identity: {
        company: 'ACME',
        developerName: 'Matias',
        name: 'BOT-Oscar',
        tone: 'claro',
      },
      ai: {
        systemPrompt: 'Sos {botName} de {company}.',
        ragTopK: 3,
        maxHistoryMessages: 8,
        memoryEnabled: true,
        memoryRecentMessages: 4,
        memorySummaryThreshold: 2,
      },
    },
    interpolate: (template: string, vars: Record<string, string>) =>
      template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`),
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    tempDir = mkdtempSync(join(tmpdir(), 'bot-oscar-ai-memory-'));
    process.env.BOT_OSCAR_DB_PATH = join(tempDir, 'bugmate.sqlite');
    database = new DatabaseService();
    database.onModuleInit();
    memory = new ConversationMemoryService(database);
    aiProvider = {
      providerName: 'fake',
      generate: jest.fn().mockResolvedValue({ text: 'respuesta' }),
    };
    service = new AiConversationService(
      aiProvider as any,
      configLoader as any,
      { buildContext: jest.fn().mockResolvedValue({ found: false, promptSection: '', citations: [] }) } as any,
      memory,
    );
  });

  afterEach(() => {
    database.connection.close();
    rmSync(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('adds persistent summary and recent messages to AI requests', async () => {
    memory.record('5491@c.us', 'user', 'mi sistema es CRM');
    memory.saveSummary('5491@c.us', 'El cliente usa CRM.', 1);
    memory.record('5491@c.us', 'user', 'tengo una duda');

    await service.generateResponse({ senderId: '5491@c.us', prompt: 'ayuda' });

    expect(aiProvider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('El cliente usa CRM.'),
        history: expect.arrayContaining([{ role: 'user', content: 'tengo una duda' }]),
      }),
    );
  });

  it('summarizes conversations when unsummarized threshold is reached', async () => {
    aiProvider.generate.mockResolvedValueOnce({ text: 'Resumen compacto.' });
    memory.record('5491@c.us', 'user', 'hola');
    memory.record('5491@c.us', 'assistant', 'buenas');

    await service.summarizeIfNeeded('5491@c.us');

    expect(memory.getSummary('5491@c.us')).toBe('Resumen compacto.');
    expect(memory.getContext('5491@c.us').unsummarizedCount).toBe(0);
  });

  it('appends sources when RAG context is used', async () => {
    service = new AiConversationService(
      aiProvider as any,
      configLoader as any,
      {
        buildContext: jest.fn().mockResolvedValue({
          found: true,
          promptSection: 'Contexto [S1]',
          citations: [
            {
              index: 1,
              label: 'S1',
              source: 'manual.md',
              score: 0.91,
              content: 'Dato importante',
            },
          ],
        }),
      } as any,
      memory,
    );

    const response = await service.generateResponse({
      senderId: '5491@c.us',
      prompt: 'consulta',
      useKnowledge: true,
    });

    expect(response.text).toContain('Fuentes: [S1] manual.md');
    expect(response.rag.citations[0]).toMatchObject({ label: 'S1', source: 'manual.md' });
  });

  it('does not append sources when RAG context is not used', async () => {
    const response = await service.generateResponse({
      senderId: '5491@c.us',
      prompt: 'consulta',
      useKnowledge: false,
    });

    expect(response.text).toBe('respuesta');
    expect(response.text).not.toContain('Fuentes:');
  });
});
