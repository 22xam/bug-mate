import { delay, of, throwError } from 'rxjs';
import { OpenRouterProvider } from './openrouter.provider';

describe('OpenRouterProvider race mode', () => {
  let httpService: { post: jest.Mock; get: jest.Mock };
  let botConfig: any;
  let configLoader: any;

  beforeEach(() => {
    delete process.env.OPENROUTER_FALLBACK_MODELS;
    httpService = { post: jest.fn(), get: jest.fn() };
    botConfig = {
      openRouterApiKey: 'key',
      openRouterBaseUrl: 'https://openrouter.ai/api/v1',
      openRouterAppName: 'BOT-Oscar',
      openRouterSiteUrl: undefined,
      openRouterTimeoutMs: 1000,
      openRouterRaceModels: true,
    };
    configLoader = {
      botConfig: {
        identity: {
          company: 'ACME',
          developerName: 'Matias',
          name: 'BOT-Oscar',
          tone: 'claro',
        },
        ai: {
          model: 'slow-model',
          fallbackModels: ['fast-model'],
          systemPrompt: 'Sos {botName}',
        },
      },
      interpolate: (template: string, vars: Record<string, string>) =>
        template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`),
    };
  });

  it('returns the first successful model in race mode', async () => {
    httpService.post.mockImplementation((_url, body) => {
      if (body.model === 'slow-model') {
        return of({
          data: {
            id: 'slow',
            model: 'slow-model',
            choices: [{ message: { content: 'lenta' } }],
          },
        }).pipe(delay(30));
      }
      return of({
        data: {
          id: 'fast',
          model: 'fast-model',
          choices: [{ message: { content: 'rapida' } }],
        },
      });
    });

    const provider = new OpenRouterProvider(httpService as any, botConfig, configLoader);
    const response = await provider.generate({ prompt: 'hola' });

    expect(response.text).toBe('rapida');
    expect(response.metadata).toMatchObject({
      raceMode: true,
      winnerModel: 'fast-model',
      raceModels: ['slow-model', 'fast-model'],
    });
  });

  it('throws a combined error when all race models fail', async () => {
    httpService.post.mockImplementation((_url, body) =>
      throwError(() => ({
        response: { data: { error: { message: `${body.model} down` } } },
      })),
    );

    const provider = new OpenRouterProvider(httpService as any, botConfig, configLoader);

    await expect(provider.generate({ prompt: 'hola' })).rejects.toThrow(
      /all OpenRouter models failed.*slow-model: slow-model down.*fast-model: fast-model down/,
    );
  });

  it('uses sequential mode when race mode is disabled', async () => {
    botConfig.openRouterRaceModels = false;
    httpService.post
      .mockReturnValueOnce(throwError(() => ({ response: { data: { message: 'primary down' } } })))
      .mockReturnValueOnce(
        of({
          data: {
            id: 'fallback',
            model: 'fast-model',
            choices: [{ message: { content: 'fallback ok' } }],
          },
        }),
      );

    const provider = new OpenRouterProvider(httpService as any, botConfig, configLoader);
    const response = await provider.generate({ prompt: 'hola' });

    expect(response.text).toBe('fallback ok');
    expect(httpService.post).toHaveBeenCalledTimes(2);
  });
});
