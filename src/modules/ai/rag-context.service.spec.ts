import { RagContextService } from './rag-context.service';
import { KnowledgeService } from '../knowledge/knowledge.service';

describe('RagContextService', () => {
  it('builds S-style citations from knowledge results', async () => {
    const knowledge = {
      searchMany: jest.fn().mockResolvedValue([
        { source: 'manual.md', score: 0.93, content: 'Paso uno' },
        { source: 'faq:login', score: 1, content: 'Respuesta FAQ' },
      ]),
    };
    const service = new RagContextService({
      get: jest.fn((token) => (token === KnowledgeService ? knowledge : undefined)),
    } as any);

    const context = await service.buildContext({
      query: 'login',
      maxResults: 2,
      instruction: 'Se breve.',
    });

    expect(context.found).toBe(true);
    expect(context.citations).toEqual([
      { index: 1, label: 'S1', source: 'manual.md', score: 0.93, content: 'Paso uno' },
      { index: 2, label: 'S2', source: 'faq:login', score: 1, content: 'Respuesta FAQ' },
    ]);
    expect(context.promptSection).toContain('[S1] Fuente: manual.md');
    expect(context.promptSection).toContain('Citá las fuentes usadas con el formato [S1], [S2]');
  });
});
