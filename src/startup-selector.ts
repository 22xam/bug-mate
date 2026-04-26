/**
 * Interactive AI provider + model selector that runs before NestJS boots.
 * Reads current .env, lets the user pick provider and model, then patches
 * process.env so ConfigService picks up the new values without touching disk.
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// ─── Terminal helpers ─────────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const WHITE  = '\x1b[37m';
const DIM    = '\x1b[2m';

function print(text: string) { process.stdout.write(text + '\n'); }
function header(text: string) { print(`\n${BOLD}${CYAN}${text}${RESET}`); }
function info(text: string)   { print(`  ${WHITE}${text}${RESET}`); }
function ok(text: string)     { print(`  ${GREEN}✔ ${text}${RESET}`); }
function warn(text: string)   { print(`  ${YELLOW}⚠ ${text}${RESET}`); }
function err(text: string)    { print(`  ${RED}✖ ${text}${RESET}`); }
function dim(text: string)    { print(`  ${DIM}${text}${RESET}`); }

function banner() {
  print('');
  print(`${BOLD}${RED}╔══════════════════════════════════════════╗${RESET}`);
  print(`${BOLD}${RED}║   🔴  Evangelina — Lista 26 Roja         ║${RESET}`);
  print(`${BOLD}${RED}║       Configuración de Proveedor IA      ║${RESET}`);
  print(`${BOLD}${RED}╚══════════════════════════════════════════╝${RESET}`);
  print('');
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

function askNumber(rl: readline.Interface, prompt: string, max: number): Promise<number> {
  return new Promise((resolve) => {
    const attempt = () => {
      rl.question(prompt, (ans) => {
        const n = parseInt(ans.trim(), 10);
        if (!isNaN(n) && n >= 1 && n <= max) {
          resolve(n);
        } else {
          warn(`Ingresá un número entre 1 y ${max}`);
          attempt();
        }
      });
    };
    attempt();
  });
}

// ─── .env reader/writer ───────────────────────────────────────────────────────

function readEnv(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    result[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return result;
}

function writeEnv(values: Record<string, string>) {
  const envPath = path.join(process.cwd(), '.env');
  const existing = readEnv();
  const merged = { ...existing, ...values };
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
  // Also patch process.env so NestJS picks up changes in the same process
  for (const [k, v] of Object.entries(values)) {
    process.env[k] = v;
  }
}

// ─── HTTP helper (uses Node https/http to respect NODE_TLS_REJECT_UNAUTHORIZED) ──

function httpGet(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...headers },
      rejectUnauthorized: false,
    };
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Request timeout')); });
    req.end();
  });
}

// ─── Provider model fetchers ──────────────────────────────────────────────────

async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const body = await httpGet(`${baseUrl}/api/tags`);
    const data = JSON.parse(body) as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name);
  } catch (e) {
    warn(`Ollama no disponible: ${(e as Error).message}`);
    return [];
  }
}

async function fetchOpenRouterModels(apiKey: string): Promise<Array<{ id: string; name: string; free: boolean }>> {
  try {
    const body = await httpGet('https://openrouter.ai/api/v1/models', {
      Authorization: `Bearer ${apiKey}`,
    });
    const data = JSON.parse(body) as { data?: Array<{ id: string; name?: string; pricing?: { prompt: string } }> };
    if (!data.data) {
      warn(`Respuesta inesperada de OpenRouter: ${body.slice(0, 200)}`);
      return [];
    }
    return data.data
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        free: m.pricing?.prompt === '0',
      }))
      .sort((a, b) => {
        if (a.free && !b.free) return -1;
        if (!a.free && b.free) return 1;
        return a.id.localeCompare(b.id);
      });
  } catch (e) {
    warn(`Error consultando OpenRouter: ${(e as Error).message}`);
    return [];
  }
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

// ─── Provider flows ───────────────────────────────────────────────────────────

async function configureGemini(rl: readline.Interface, env: Record<string, string>): Promise<void> {
  header('📦 Proveedor: Google Gemini');

  let apiKey = env['GEMINI_API_KEY'] ?? '';
  if (apiKey) {
    ok(`API Key detectada: ${apiKey.slice(0, 8)}...`);
    const change = await ask(rl, `  ¿Cambiarla? (s/N): `);
    if (change.toLowerCase() === 's') apiKey = '';
  }

  if (!apiKey) {
    apiKey = await ask(rl, `  ${CYAN}Pegá tu Gemini API Key: ${RESET}`);
  }

  header('🤖 Modelos disponibles');
  GEMINI_MODELS.forEach((m, i) => info(`  ${BOLD}${i + 1}.${RESET} ${m}`));
  const choice = await askNumber(rl, `\n  ${CYAN}Elegí un modelo (1-${GEMINI_MODELS.length}): ${RESET}`, GEMINI_MODELS.length);
  const model = GEMINI_MODELS[choice - 1];

  writeEnv({
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: apiKey,
  });

  // Update bot.config.json model
  patchBotConfigModel(model, 'text-embedding-004');

  ok(`Gemini configurado → modelo: ${BOLD}${model}${RESET}`);
}

async function configureOllama(rl: readline.Interface, env: Record<string, string>): Promise<void> {
  header('📦 Proveedor: Ollama (local)');

  const defaultUrl = env['OLLAMA_URL'] ?? 'http://localhost:11434';
  const urlInput = await ask(rl, `  ${CYAN}URL de Ollama [${defaultUrl}]: ${RESET}`);
  const ollamaUrl = urlInput || defaultUrl;

  info('Consultando modelos instalados...');
  const models = await fetchOllamaModels(ollamaUrl);

  if (models.length === 0) {
    warn('No se encontraron modelos en Ollama o no está corriendo.');
    warn(`Asegurate de tener Ollama corriendo en ${ollamaUrl}`);
    const manual = await ask(rl, `  ${CYAN}Ingresá el nombre del modelo manualmente: ${RESET}`);
    writeEnv({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollamaUrl });
    patchBotConfigModel(manual, manual);
    ok(`Ollama configurado → modelo: ${BOLD}${manual}${RESET}`);
    return;
  }

  header('🤖 Modelos instalados en Ollama');
  models.forEach((m, i) => info(`  ${BOLD}${i + 1}.${RESET} ${m}`));
  const choice = await askNumber(rl, `\n  ${CYAN}Elegí un modelo (1-${models.length}): ${RESET}`, models.length);
  const model = models[choice - 1];

  writeEnv({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollamaUrl });
  patchBotConfigModel(model, model);

  ok(`Ollama configurado → modelo: ${BOLD}${model}${RESET}`);
}

async function configureOpenRouter(rl: readline.Interface, env: Record<string, string>): Promise<void> {
  header('📦 Proveedor: OpenRouter');

  let apiKey = env['OPENROUTER_API_KEY'] ?? '';
  if (apiKey) {
    ok(`API Key detectada: ${apiKey.slice(0, 12)}...`);
    const change = await ask(rl, `  ¿Cambiarla? (s/N): `);
    if (change.toLowerCase() === 's') apiKey = '';
  }

  if (!apiKey) {
    apiKey = await ask(rl, `  ${CYAN}Pegá tu OpenRouter API Key: ${RESET}`);
  }

  info('Consultando modelos en OpenRouter...');
  const models = await fetchOpenRouterModels(apiKey);

  if (models.length === 0) {
    err('No se pudieron obtener modelos. Verificá la API key y tu conexión.');
    const manual = await ask(rl, `  ${CYAN}Ingresá el ID del modelo manualmente (ej: minimax/minimax-m1): ${RESET}`);
    writeEnv({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: apiKey });
    patchBotConfigModel(manual, 'text-embedding-004');
    ok(`OpenRouter configurado → modelo: ${BOLD}${manual}${RESET}`);
    return;
  }

  // Show free models first, then paginate
  const freeModels = models.filter((m) => m.free);
  const paidModels = models.filter((m) => !m.free);

  header(`🆓 Modelos GRATUITOS (${freeModels.length})`);
  freeModels.slice(0, 30).forEach((m, i) =>
    info(`  ${BOLD}${i + 1}.${RESET} ${GREEN}[FREE]${RESET} ${m.id} ${DIM}${m.name !== m.id ? `— ${m.name}` : ''}${RESET}`)
  );

  const showPaid = await ask(rl, `\n  ¿Ver también modelos de pago? (s/N): `);
  let allDisplayed = [...freeModels.slice(0, 30)];

  if (showPaid.toLowerCase() === 's') {
    header(`💰 Modelos de pago (${paidModels.length} — mostrando primeros 50)`);
    paidModels.slice(0, 50).forEach((m, i) =>
      info(`  ${BOLD}${freeModels.slice(0, 30).length + i + 1}.${RESET} ${m.id} ${DIM}${m.name !== m.id ? `— ${m.name}` : ''}${RESET}`)
    );
    allDisplayed = [...freeModels.slice(0, 30), ...paidModels.slice(0, 50)];
  }

  const choice = await askNumber(
    rl,
    `\n  ${CYAN}Elegí un modelo (1-${allDisplayed.length}): ${RESET}`,
    allDisplayed.length,
  );
  const selected = allDisplayed[choice - 1];

  writeEnv({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: apiKey });
  patchBotConfigModel(selected.id, 'text-embedding-004');

  ok(`OpenRouter configurado → modelo: ${BOLD}${selected.id}${RESET}`);
}

// ─── bot.config.json patcher ──────────────────────────────────────────────────

function patchBotConfigModel(model: string, embeddingModel: string) {
  const configPath = path.join(process.cwd(), 'config', 'bot.config.json');
  if (!fs.existsSync(configPath)) return;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.ai = config.ai ?? {};
    config.ai.model = model;
    config.ai.embeddingModel = embeddingModel;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    warn('No se pudo actualizar bot.config.json — editalo manualmente.');
  }
}

// ─── Main selector ────────────────────────────────────────────────────────────

export async function runStartupSelector(): Promise<void> {
  banner();

  const env = readEnv();
  const currentProvider = process.env['AI_PROVIDER'] ?? env['AI_PROVIDER'] ?? 'gemini';
  const currentModel = (() => {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'bot.config.json'), 'utf-8'));
      return cfg?.ai?.model ?? '—';
    } catch { return '—'; }
  })();

  info(`Proveedor actual: ${BOLD}${currentProvider}${RESET}  |  Modelo: ${BOLD}${currentModel}${RESET}`);
  print('');

  const providers = ['Gemini (Google)', 'Ollama (local)', 'OpenRouter', 'Continuar sin cambios'];
  providers.forEach((p, i) => {
    const isCurrent =
      (i === 0 && currentProvider === 'gemini') ||
      (i === 1 && currentProvider === 'ollama') ||
      (i === 2 && currentProvider === 'openrouter');
    info(`  ${BOLD}${i + 1}.${RESET} ${p}${isCurrent ? ` ${GREEN}← actual${RESET}` : ''}`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const choice = await askNumber(rl, `\n  ${CYAN}Seleccioná una opción (1-4): ${RESET}`, 4);

    if (choice === 1) await configureGemini(rl, env);
    else if (choice === 2) await configureOllama(rl, env);
    else if (choice === 3) await configureOpenRouter(rl, env);
    else {
      ok(`Continuando con ${currentProvider} / ${currentModel}`);
    }
  } finally {
    rl.close();
  }

  print('');
  print(`${BOLD}${GREEN}▶ Iniciando Evangelina...${RESET}`);
  print('');
}
