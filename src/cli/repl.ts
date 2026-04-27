import * as readline from 'readline';
import { ApiClient } from './api-client';
import { c, ok, fail, info, warn, banner, spinner, botMsg } from './display';
import * as cmds from './commands';

// ─── Tab completion ───────────────────────────────────────────────────────────

const TOP_COMMANDS = [
  'status', 'sessions', 'session', 'flows',
  'pause', 'resume', 'paused', 'chat',
  'knowledge', 'clients', 'campaigns', 'optouts', 'skills',
  'config', 'trello', 'openrouter',
  'clear', 'help', 'exit', 'quit',
];

const SUB_COMMANDS: Record<string, string[]> = {
  session:   ['clear'],
  knowledge: ['search', 'rebuild'],
  clients:   ['list', 'show', 'add'],
  campaigns: ['list', 'show', 'create', 'run', 'runs'],
  optouts:   ['list', 'add', 'remove'],
  skills:    ['list', 'show', 'run'],
  openrouter: ['models'],
};

function completer(line: string): [string[], string] {
  const parts = line.trimStart().split(/\s+/);

  if (parts.length <= 1) {
    const hits = TOP_COMMANDS.filter((cmd) => cmd.startsWith(parts[0] ?? ''));
    return [hits.length ? hits : TOP_COMMANDS, parts[0] ?? ''];
  }

  const sub = SUB_COMMANDS[parts[0]];
  if (sub) {
    const partial = parts[1] ?? '';
    const hits = sub.filter((s) => s.startsWith(partial));
    return [hits.length ? hits : sub, partial];
  }

  return [[], line];
}

// ─── REPL ─────────────────────────────────────────────────────────────────────

export async function startRepl(client: ApiClient): Promise<void> {
  banner();

  // Connection check
  process.stdout.write(`  Conectando a ${c.cyan}${client.baseUrl}${c.reset} ...`);
  const connected = await client.isConnected();

  if (!connected) {
    console.log(` ${c.red}✗${c.reset}\n`);
    console.log(`  ${c.red}${c.bold}No se pudo conectar al servidor BugMate.${c.reset}\n`);
    console.log(`  Asegurate de que el bot esté corriendo:`);
    console.log(`    ${c.cyan}npm run start${c.reset}   (producción)`);
    console.log(`    ${c.cyan}npm run start:dev${c.reset} (desarrollo)\n`);
    console.log(`  Si usás otro puerto, configurá: ${c.cyan}BUGMATE_URL=http://localhost:XXXX${c.reset}\n`);
    process.exit(1);
  }

  console.log(` ${c.green}✓ conectado${c.reset}`);

  try {
    const s = await client.get<any>('/api/status');
    console.log(
      `  ${c.dim}${s.botName} · ${s.company} · modo ${s.mode} · uptime ${s.uptimeFormatted}${c.reset}`,
    );
  } catch { /* ignore */ }

  console.log(`\n  Escribí ${c.cyan}help${c.reset} para ver todos los comandos disponibles.\n`);

  const rl = readline.createInterface({
    input:     process.stdin,
    output:    process.stdout,
    prompt:    `${c.green}${c.bold}bugmate${c.reset}${c.bold}>${c.reset} `,
    completer,
  });

  rl.prompt();

  rl.on('line', async (input: string) => {
    const line = input.trim();
    if (!line) {
      rl.prompt();
      return;
    }

    const [cmd, ...args] = line.split(/\s+/);

    try {
      const handled = await dispatch(cmd.toLowerCase(), args, client, rl);
      if (!handled) {
        console.log(
          warn(`Comando desconocido: ${c.bold}${cmd}${c.reset}. Escribí ${c.cyan}help${c.reset} para ver los comandos.`),
        );
      }
    } catch (err: any) {
      console.log(fail(`${err.message}`));
    }

    console.log('');
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n  ${c.dim}Hasta luego!${c.reset}\n`);
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log(`\n  ${c.dim}Hasta luego!${c.reset}\n`);
    process.exit(0);
  });
}

// ─── Command dispatcher ───────────────────────────────────────────────────────

async function dispatch(
  cmd: string,
  args: string[],
  client: ApiClient,
  rl: readline.Interface,
): Promise<boolean> {
  switch (cmd) {
    case 'status': case 's':
      await cmds.cmdStatus(client);
      return true;

    case 'sessions': case 'ses':
      await cmds.cmdSessions(client);
      return true;

    case 'session':
      if (args[0] === 'clear') {
        await cmds.cmdSessionClear(client, args[1]);
      } else {
        console.log(info('Uso: session clear <número>'));
      }
      return true;

    case 'flows': case 'f':
      await cmds.cmdFlows(client);
      return true;

    case 'pause':
      await cmds.cmdPause(client, args[0]);
      return true;

    case 'resume':
      await cmds.cmdResume(client, args[0]);
      return true;

    case 'paused':
      await cmds.cmdPaused(client);
      return true;

    case 'chat': {
      if (!args[0]) {
        console.log(fail('Indicá un número: chat <número>'));
      } else {
        await runChatMode(rl, client, args[0]);
      }
      return true;
    }

    case 'knowledge': case 'k':
      if (args[0] === 'search') {
        await cmds.cmdKnowledgeSearch(client, args.slice(1).join(' '));
      } else if (args[0] === 'rebuild') {
        await cmds.cmdKnowledgeRebuild(client);
      } else {
        console.log(info('Uso: knowledge search <query>  |  knowledge rebuild'));
      }
      return true;

    case 'clients': case 'c':
      if (!args[0] || args[0] === 'list') {
        await cmds.cmdClients(client);
      } else if (args[0] === 'show') {
        await cmds.cmdClientShow(client, args[1]);
      } else if (args[0] === 'add') {
        await cmds.cmdClientAdd(client, args.slice(1));
      } else {
        console.log(info('Uso: clients [list] | clients show <teléfono> | clients add <teléfono> <nombre>'));
      }
      return true;

    case 'campaigns': case 'camp':
      if (!args[0] || args[0] === 'list') {
        await cmds.cmdCampaigns(client);
      } else if (args[0] === 'show') {
        await cmds.cmdCampaignShow(client, args[1]);
      } else if (args[0] === 'create') {
        await cmds.cmdCampaignCreate(client, args.slice(1));
      } else if (args[0] === 'run') {
        await cmds.cmdCampaignRun(client, args.slice(1));
      } else if (args[0] === 'runs') {
        await cmds.cmdCampaignRuns(client, args[1]);
      } else {
        console.log(info('Uso: campaigns [list] | campaigns show <id> | campaigns create <nombre> <mensaje> | campaigns run <id> | campaigns runs [id]'));
      }
      return true;

    case 'optouts': case 'opt-outs':
      if (!args[0] || args[0] === 'list') {
        await cmds.cmdOptOuts(client);
      } else if (args[0] === 'add') {
        await cmds.cmdOptOutAdd(client, args.slice(1));
      } else if (args[0] === 'remove' || args[0] === 'delete') {
        await cmds.cmdOptOutRemove(client, args[1]);
      } else {
        console.log(info('Uso: optouts [list] | optouts add <teléfono> [motivo] | optouts remove <teléfono>'));
      }
      return true;

    case 'skills':
      if (!args[0] || args[0] === 'list') {
        await cmds.cmdSkills(client);
      } else if (args[0] === 'show') {
        await cmds.cmdSkillShow(client, args[1]);
      } else if (args[0] === 'run') {
        await cmds.cmdSkillRun(client, args.slice(1));
      } else {
        console.log(info('Uso: skills [list] | skills show <id> | skills run <id> [input]'));
      }
      return true;

    case 'config': case 'cfg':
      await cmds.cmdConfig(client);
      return true;

    case 'trello': case 't':
      await cmds.cmdTrello(client);
      return true;

    case 'openrouter': case 'or':
      if (args[0] === 'models') {
        const kind = args[1] === 'embeddings' || args[1] === 'all' ? args[1] : 'chat';
        await cmds.cmdOpenRouterModels(client, kind);
      } else {
        console.log(info('Uso: openrouter models [embeddings|all]'));
      }
      return true;

    case 'clear': case 'cls':
      console.clear();
      return true;

    case 'help': case '?': case 'h':
      printHelp();
      return true;

    case 'exit': case 'quit': case 'q':
      console.log(`\n  ${c.dim}Hasta luego!${c.reset}\n`);
      rl.close();
      process.exit(0);

    default:
      return false;
  }
}

// ─── Chat simulation sub-mode ─────────────────────────────────────────────────

async function runChatMode(
  parentRl: readline.Interface,
  client: ApiClient,
  number: string,
): Promise<void> {
  const senderId = number.includes('@') ? number : `${number}@c.us`;
  const display  = number.replace('@c.us', '');

  console.log(`\n  ${c.cyan}${c.bold}Chat simulado con ${display}${c.reset}`);
  console.log(`  ${c.dim}Los mensajes pasan por toda la lógica del bot (sin WhatsApp real).${c.reset}`);
  console.log(`  ${c.dim}Escribí ${c.cyan}exit${c.reset}${c.dim} o presioná Ctrl+C para volver al menú principal.${c.reset}\n`);

  // Pause parent readline while in chat sub-mode
  parentRl.pause();
  (parentRl as any).terminal = false;

  const chatRl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: `  ${c.yellow}${c.bold}tú${c.reset}${c.yellow}>${c.reset} `,
  });

  chatRl.prompt();

  await new Promise<void>((resolve) => {
    chatRl.on('line', async (input: string) => {
      const text = input.trim();

      if (!text) {
        chatRl.prompt();
        return;
      }

      if (text === 'exit' || text === 'salir' || text === 'quit') {
        chatRl.close();
        return;
      }

      const stop = spinner('Procesando...');

      try {
        const res = await client.post<any>('/api/test/message', { senderId, text });
        stop();

        if (res.responses.length === 0) {
          console.log(`  ${c.dim}(sin respuesta)${c.reset}`);
        } else {
          for (const msg of res.responses) {
            console.log(`\n${botMsg(msg)}\n`);
          }
        }

        if (res.session) {
          const st = res.session;
          const flowInfo = st.activeConditionalFlowId
            ? ` [${st.activeConditionalFlowId}${st.activeStepId ? ' → ' + st.activeStepId : ''}]`
            : st.activeFlowId
              ? ` [${st.activeFlowId}]`
              : '';
          process.stdout.write(
            `  ${c.dim}estado: ${st.state}${flowInfo}${c.reset}\n\n`,
          );
        }
      } catch (err: any) {
        stop();
        console.log(`  ${fail(err.message)}\n`);
      }

      chatRl.prompt();
    });

    chatRl.on('close', () => {
      console.log(`\n  ${c.dim}Saliendo del chat simulado...${c.reset}`);
      resolve();
    });

    process.once('SIGINT', () => {
      chatRl.close();
    });
  });

  // Restore parent readline
  (parentRl as any).terminal = true;
  parentRl.resume();
}

// ─── Help text ────────────────────────────────────────────────────────────────

function printHelp(): void {
  const cmd = (name: string) => `${c.cyan}${c.bold}${name}${c.reset}`;
  const arg = (name: string) => `${c.yellow}${name}${c.reset}`;

  console.log(`
${c.bold}Comandos disponibles:${c.reset}

  ${cmd('status')}                          Estado del bot (uptime, IA, sesiones)
  ${cmd('sessions')}                        Lista sesiones activas
  ${cmd('session clear')} ${arg('<número>')}        Limpia la sesión de un número
  ${cmd('flows')}                           Flujos configurados
  ${cmd('pause')} ${arg('<número>')}               Pausa el bot para ese número
  ${cmd('resume')} ${arg('<número|all>')}          Reanuda el bot para ese número o todos
  ${cmd('paused')}                          Muestra senders pausados
  ${cmd('chat')} ${arg('<número>')}                Simula una conversación completa
  ${cmd('knowledge search')} ${arg('<query>')}    Busca en la base de conocimiento
  ${cmd('knowledge rebuild')}              Reconstruye el índice vectorial
  ${cmd('clients')}                         Lista de clientes registrados
  ${cmd('clients show')} ${arg('<teléfono>')}      Detalle de cliente
  ${cmd('clients add')} ${arg('<teléfono> <nombre>')} Crea un cliente
  ${cmd('campaigns')}                       Lista campañas
  ${cmd('campaigns show')} ${arg('<id>')}          Detalle de campaña
  ${cmd('campaigns create')} ${arg('<nombre> <mensaje>')} Crea una campaña
  ${cmd('campaigns run')} ${arg('<id>')}           Ejecuta una campaña
  ${cmd('campaigns runs')} ${arg('[id]')}          Lista ejecuciones
  ${cmd('optouts')}                         Lista opt-outs
  ${cmd('optouts add')} ${arg('<teléfono> [motivo]')} Registra una baja
  ${cmd('optouts remove')} ${arg('<teléfono>')}    Elimina una baja
  ${cmd('skills')}                          Lista skills disponibles
  ${cmd('skills show')} ${arg('<id>')}             Detalle de skill
  ${cmd('skills run')} ${arg('<id> [input]')}      Ejecuta un skill
  ${cmd('config')}                          Configuración completa del bot
  ${cmd('trello')}                          Tableros y columnas de Trello
  ${cmd('openrouter models')} ${arg('[embeddings|all]')} Modelos disponibles en OpenRouter
  ${cmd('clear')}                           Limpia la pantalla
  ${cmd('help')}                            Muestra esta ayuda
  ${cmd('exit')}                            Sale del CLI

${c.dim}Tip: usá Tab para autocompletar comandos.${c.reset}`);
}
