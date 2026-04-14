import { ApiClient } from './api-client';
import { c, ok, fail, info, warn, header, table } from './display';

// ─── Status ───────────────────────────────────────────────────────────────────

export async function cmdStatus(client: ApiClient): Promise<void> {
  const s = await client.get<any>('/api/status');

  console.log(header('Estado del Bot'));
  console.log(`  ${c.bold}Nombre:${c.reset}   ${c.white}${s.botName}${c.reset} (${s.company})`);
  console.log(`  ${c.bold}Uptime:${c.reset}   ${c.green}${s.uptimeFormatted}${c.reset}`);
  console.log(`  ${c.bold}IA:${c.reset}       ${c.cyan}${s.aiProvider}${c.reset}`);
  console.log(`  ${c.bold}Modo:${c.reset}     ${c.yellow}${s.mode}${c.reset}`);
  console.log(`  ${c.bold}Sesiones:${c.reset} ${c.bold}${s.activeSessions}${c.reset} activas`);
  console.log(
    `  ${c.bold}Trello:${c.reset}   ${s.trelloEnabled ? c.green + '✓ conectado' : c.red + '✗ no configurado'}${c.reset}`,
  );

  if (s.pausedCount > 0) {
    console.log(
      `  ${c.bold}Pausados:${c.reset} ${c.yellow}${s.pausedCount}${c.reset} — ${s.pausedSenders.join(', ')}`,
    );
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function cmdSessions(client: ApiClient): Promise<void> {
  const sessions = await client.get<any[]>('/api/sessions');

  if (sessions.length === 0) {
    console.log(info('No hay sesiones activas'));
    return;
  }

  console.log(header(`Sesiones activas (${sessions.length})`));

  const rows = sessions.map((s) => [
    s.senderId.replace('@c.us', '').replace('@lid', ''),
    s.clientName ?? '—',
    colorState(s.state),
    s.activeConditionalFlowId ?? s.activeFlowId ?? '—',
    s.activeStepId ?? '—',
    timeAgo(new Date(s.lastActivityAt)),
  ]);

  console.log(
    table(
      ['Número', 'Cliente', 'Estado', 'Flujo', 'Paso', 'Actividad'],
      rows,
    ),
  );
}

export async function cmdSessionClear(client: ApiClient, number: string): Promise<void> {
  if (!number) {
    console.log(fail('Indicá un número: session clear <número>'));
    return;
  }
  const res = await client.del<any>(`/api/sessions/${number}`);
  console.log(ok(res.message));
}

// ─── Flows ───────────────────────────────────────────────────────────────────

export async function cmdFlows(client: ApiClient): Promise<void> {
  const { conditionalFlows, legacyFlows } = await client.get<any>('/api/flows');

  if (conditionalFlows.length === 0 && legacyFlows.length === 0) {
    console.log(warn('No hay flujos configurados'));
    return;
  }

  if (conditionalFlows.length > 0) {
    console.log(header('Flujos condicionales'));
    for (const flow of conditionalFlows) {
      console.log(`  ${c.bold}${c.cyan}${flow.id}${c.reset}  ${c.dim}${flow.stepCount} pasos:${c.reset} ${flow.steps.join(' → ')}`);
    }
  }

  if (legacyFlows.length > 0) {
    console.log(header('Flujos legacy'));
    for (const flow of legacyFlows) {
      const typeColor = flow.type === 'guided' ? c.blue : c.magenta;
      console.log(`  ${c.bold}${c.cyan}${flow.id}${c.reset}  [${typeColor}${flow.type}${c.reset}]  ${c.dim}${flow.detail}${c.reset}`);
    }
  }
}

// ─── Pause / Resume ───────────────────────────────────────────────────────────

export async function cmdPause(client: ApiClient, number: string): Promise<void> {
  if (!number) {
    console.log(fail('Indicá un número: pause <número>'));
    return;
  }
  const res = await client.post<any>('/api/pause', { number });
  console.log(res.isNew ? ok(`Bot pausado para ${c.bold}${number}${c.reset}`) : info(`Ya estaba pausado para ${number}`));
}

export async function cmdResume(client: ApiClient, number: string): Promise<void> {
  if (!number) {
    console.log(fail('Indicá un número: resume <número>'));
    return;
  }
  const res = await client.post<any>('/api/resume', { number });
  console.log(res.existed ? ok(`Bot reanudado para ${c.bold}${number}${c.reset}`) : info(`No estaba pausado para ${number}`));
}

export async function cmdPaused(client: ApiClient): Promise<void> {
  const { senders } = await client.get<any>('/api/paused');
  if (senders.length === 0) {
    console.log(info('No hay senders pausados'));
    return;
  }
  console.log(header(`Senders pausados (${senders.length})`));
  for (const s of senders) {
    console.log(`  ${c.yellow}⏸${c.reset}  ${s}`);
  }
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function cmdClients(client: ApiClient): Promise<void> {
  const clients = await client.get<any[]>('/api/clients');

  if (clients.length === 0) {
    console.log(info('No hay clientes configurados'));
    return;
  }

  console.log(header(`Clientes registrados (${clients.length})`));

  const rows = clients.map((c) => [
    c.name ?? '—',
    c.phone ?? '—',
    c.email ?? '—',
    c.plan ?? '—',
  ]);
  console.log(table(['Nombre', 'Teléfono', 'Email', 'Plan'], rows));
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function cmdConfig(client: ApiClient): Promise<void> {
  const cfg = await client.get<any>('/api/config');

  console.log(header('Identidad'));
  console.log(`  ${c.bold}Nombre:${c.reset}     ${cfg.identity.name}`);
  console.log(`  ${c.bold}Empresa:${c.reset}    ${cfg.identity.company}`);
  console.log(`  ${c.bold}Dev:${c.reset}        ${cfg.identity.developerName}`);
  if (cfg.identity.tone) console.log(`  ${c.bold}Tono:${c.reset}       ${cfg.identity.tone}`);

  console.log(header('Comportamiento'));
  console.log(`  ${c.bold}Modo:${c.reset}       ${c.yellow}${cfg.mode}${c.reset}`);
  console.log(`  ${c.bold}IA:${c.reset}         ${c.cyan}${cfg.ai.provider}${c.reset}`);
  console.log(`  ${c.bold}Conocimiento:${c.reset} ${cfg.ai.useKnowledge ? c.green + '✓ activo' : c.red + '✗ inactivo'}${c.reset}`);
  if (cfg.ai.useKnowledge) {
    console.log(`  ${c.bold}RAG top-K:${c.reset}  ${cfg.ai.ragTopK}  ${c.bold}score mín:${c.reset} ${cfg.ai.ragMinScore}`);
  }
  console.log(`  ${c.bold}Historial:${c.reset}  ${cfg.ai.maxHistoryMessages} mensajes`);
  console.log(`  ${c.bold}Timeout:${c.reset}    ${cfg.greeting.sessionTimeoutMinutes} minutos de sesión`);

  if (cfg.menu?.options?.length > 0) {
    console.log(header('Menú'));
    for (const opt of cfg.menu.options) {
      const dest = opt.conditionalFlowId ?? opt.flowId ?? opt.action ?? '—';
      console.log(`  ${c.bold}${opt.id}.${c.reset} ${opt.label}  ${c.gray}→ ${dest}${c.reset}`);
    }
  }

  if (cfg.escalation?.keywords?.length > 0) {
    console.log(header('Escalada'));
    console.log(`  ${c.bold}Keywords:${c.reset} ${cfg.escalation.keywords.join(', ')}`);
  }

  console.log(header('Delay humano'));
  console.log(`  ${cfg.humanDelay?.enabled ? ok('activado') : fail('desactivado')}`);

  console.log(header('Trello'));
  if (cfg.trello?.enabled) {
    console.log(`  ${ok('habilitado')}`);
    const lists = Object.entries(cfg.trello.lists ?? {});
    if (lists.length > 0) {
      for (const [key, id] of lists) {
        console.log(`  ${c.bold}${key}:${c.reset} ${c.gray}${id}${c.reset}`);
      }
    }
  } else {
    console.log(`  ${warn('no configurado')}`);
  }
}

// ─── Knowledge ───────────────────────────────────────────────────────────────

export async function cmdKnowledgeSearch(client: ApiClient, query: string): Promise<void> {
  if (!query.trim()) {
    console.log(fail('Indicá una búsqueda: knowledge search <query>'));
    return;
  }

  const { result, query: q } = await client.get<any>(
    `/api/knowledge/search?q=${encodeURIComponent(query)}`,
  );

  if (!result) {
    console.log(warn(`Sin resultados para: "${q}"`));
    return;
  }

  console.log(header('Resultado de búsqueda'));
  console.log(`  ${c.bold}Score:${c.reset}  ${c.green}${result.score.toFixed(3)}${c.reset}`);
  console.log(`  ${c.bold}Fuente:${c.reset} ${c.cyan}${result.source}${c.reset}`);
  const preview = result.content.length > 400
    ? result.content.slice(0, 400) + '…'
    : result.content;
  console.log(`\n${c.dim}${preview.split('\n').map((l: string) => '  ' + l).join('\n')}${c.reset}`);
}

export async function cmdKnowledgeRebuild(client: ApiClient): Promise<void> {
  console.log(info('Reconstruyendo índice de conocimiento...'));
  const res = await client.post<any>('/api/knowledge/rebuild');
  console.log(ok(res.message));
}

// ─── Trello ───────────────────────────────────────────────────────────────────

export async function cmdTrello(client: ApiClient): Promise<void> {
  const { enabled, boards } = await client.get<any>('/api/trello/boards');

  if (!enabled) {
    console.log(warn('Trello no está configurado. Agregá TRELLO_API_KEY y TRELLO_TOKEN al .env'));
    return;
  }

  if (boards.length === 0) {
    console.log(warn('No se encontraron tableros de Trello'));
    return;
  }

  console.log(header('Tableros de Trello'));

  for (const board of boards) {
    console.log(`\n  ${c.bold}${c.cyan}${board.name}${c.reset}  ${c.gray}${board.id}${c.reset}`);
    if (board.lists.length === 0) {
      console.log(`    ${c.dim}(sin columnas)${c.reset}`);
    } else {
      for (const list of board.lists) {
        console.log(`    ${c.dim}•${c.reset} ${c.bold}${list.name}${c.reset}  ${c.gray}${list.id}${c.reset}`);
      }
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function colorState(state: string): string {
  switch (state) {
    case 'IDLE':                     return `${c.dim}${state}${c.reset}`;
    case 'AWAITING_MENU_SELECTION':  return `${c.yellow}${state}${c.reset}`;
    case 'FLOW_ACTIVE':              return `${c.blue}${state}${c.reset}`;
    case 'CONDITIONAL_FLOW_ACTIVE':  return `${c.cyan}${state}${c.reset}`;
    case 'ESCALATED':                return `${c.red}${state}${c.reset}`;
    default:                         return state;
  }
}

function timeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  return `hace ${Math.floor(diffMin / 60)}h`;
}
