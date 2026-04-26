# BugMate — WhatsApp Bot Framework con IA

Bot de WhatsApp empresarial construido con NestJS + WhatsApp Web.js que soporta múltiples proveedores de IA, flujos conversacionales configurables por JSON, sistema de conocimiento vectorial (RAG) y broadcast a clientes.

> Basado en [ignaciobecher/bug-mate](https://github.com/ignaciobecher/bug-mate) — extendido con OpenRouter, menú de inicio interactivo, broadcast de campaña, reintentos de IA y correcciones para Windows.

---

## Características

- **Múltiples proveedores de IA:** Gemini, Ollama (local) y OpenRouter — switcheable en caliente desde el menú de inicio
- **Menú de inicio interactivo:** Elegí proveedor y modelo antes de que NestJS arranque; lista modelos disponibles en tiempo real desde Ollama y OpenRouter
- **Flujos conversacionales JSON:** Sin tocar código — menús, bifurcaciones, escalación a humano
- **Modo IA puro:** Omite el menú y responde directamente con el LLM elegido
- **RAG (Retrieval-Augmented Generation):** Búsqueda vectorial SQLite + keyword match sobre documentos propios
- **Broadcast a clientes:** Envía mensajes personalizados con IA a todos los clientes registrados
- **Reintentos automáticos:** 3 intentos con back-off progresivo si la IA falla; mensaje de disculpa si los 3 fallan
- **Pausa / Reanudación:** Pausá el bot por contacto para retomar la conversación manualmente
- **REST API completa:** Status, sesiones, knowledge, test de mensajes, control de pausa
- **Control por grupo WhatsApp:** Comandos `!status`, `!paused`, `!sessions` desde un grupo designado
- **Soporte Windows:** Correcciones de TLS para Node.js nativo (`NODE_TLS_REJECT_UNAUTHORIZED=0` + `https.request`)

---

## Requisitos

- Node.js 20+
- Google Chrome / Chromium (para Puppeteer/WhatsApp Web.js)
- Una API key de Gemini, OpenRouter, o Ollama corriendo localmente

---

## Instalación

```bash
git clone <tu-repo>
cd bug-mate
npm install
```

Copiá los archivos de ejemplo:

```bash
cp .env.example .env
cp config/bot.config.example.json config/bot.config.json
cp config/clients.example.json config/clients.json
```

Editá `.env` con tus credenciales (ver sección Variables de entorno).

---

## Uso

```bash
npm run build        # Compilar TypeScript
node dist/main.js    # Iniciar bot
```

Al iniciar, aparece un **menú interactivo** para elegir proveedor de IA y modelo:

```
╔══════════════════════════════════════════╗
║   🔴  Evangelina — Lista 26 Roja         ║
║       Configuración de Proveedor IA      ║
╚══════════════════════════════════════════╝

  1. Gemini (Google)
  2. Ollama (local)
  3. OpenRouter
  4. Continuar sin cambios ← actual
```

Luego NestJS arranca, aparece el QR y escaneás con WhatsApp.

---

## Proveedores de IA

### Gemini (Google)
Configurá `GEMINI_API_KEY` en `.env`. Modelos disponibles: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`.

### OpenRouter
Configurá `OPENROUTER_API_KEY` en `.env`. Al elegir OpenRouter en el menú de inicio, el sistema consulta los modelos disponibles en tiempo real, mostrando primero los gratuitos.

> **Nota:** OpenRouter se usa para chat; los embeddings (RAG) siempre usan Gemini porque la mayoría de modelos free de OpenRouter no soportan embeddings.

### Ollama (local)
Asegurate de tener Ollama corriendo en `http://localhost:11434` (o configurá `OLLAMA_URL`). El menú lista los modelos instalados automáticamente.

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `AI_PROVIDER` | `gemini`, `ollama` o `openrouter` |
| `GEMINI_API_KEY` | API key de Google Gemini |
| `OPENROUTER_API_KEY` | API key de OpenRouter |
| `OPENROUTER_APP_NAME` | Nombre de la app (aparece en OpenRouter dashboard) |
| `OLLAMA_URL` | URL de Ollama (default: `http://localhost:11434`) |
| `DEVELOPER_PHONE` | Teléfono del admin (solo dígitos, ej: `5493874043810`) |
| `PORT` | Puerto HTTP (default: `3000`) |
| `CONTROL_GROUP_ID` | ID del grupo WhatsApp para comandos de control |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Poné `0` en Windows para evitar errores TLS |

---

## Configuración del bot (`config/bot.config.json`)

Todo el comportamiento del bot se define en JSON — sin tocar código TypeScript:

```jsonc
{
  "mode": "ai",                    // "ai" o "flow"
  "identity": {
    "name": "Nombre del bot",
    "company": "Tu empresa",
    "developerName": "Tu nombre",
    "tone": "descripción del tono"
  },
  "greeting": { ... },
  "menu": { ... },                 // Menú principal (modo flow)
  "conditionalFlows": { ... },     // Flujos con bifurcaciones
  "ai": {
    "model": "gemini-2.0-flash",
    "embeddingModel": "text-embedding-004",
    "systemPrompt": "...",
    "useKnowledge": true,
    "ragTopK": 3,
    "ragMinScore": 0.55,
    "maxHistoryMessages": 10,
    "fallbackToEscalation": true
  },
  "escalation": {
    "keywords": ["hablar con alguien", ...],
    "clientMessage": "...",
    "developerNotification": "..."
  },
  "humanDelay": {
    "enabled": true,
    "msPerCharacter": 45
  }
}
```

---

## Base de conocimiento (RAG)

Colocá archivos `.md` o `.txt` en `config/knowledge-docs/` y ejecutá:

```bash
POST http://localhost:3000/api/knowledge/rebuild
```

El sistema indexa los documentos como vectores en SQLite (`data/knowledge.sqlite`). En cada consulta IA hace:
1. Búsqueda por keywords en `knowledge.json`
2. Búsqueda vectorial por similitud coseno

---

## API REST

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/status` | GET | Estado del bot, proveedor, sesiones activas |
| `/api/clients` | GET | Lista de clientes registrados |
| `/api/sessions` | GET | Sesiones conversacionales activas |
| `/api/sessions/:id` | DELETE | Reiniciar sesión de un cliente |
| `/api/pause` | POST | Pausar bot para un número `{ number }` |
| `/api/resume` | POST | Reanudar bot para un número `{ number }` |
| `/api/resume/all` | POST | Reanudar todos los pausados |
| `/api/paused` | GET | Lista de números pausados |
| `/api/broadcast/good-morning` | POST | Enviar mensaje de campaña a clientes `{ phones? }` |
| `/api/test/message` | POST | Simular mensaje sin WhatsApp real `{ senderId, text }` |
| `/api/knowledge/search` | GET | Buscar en knowledge `?q=texto` |
| `/api/knowledge/rebuild` | POST | Re-indexar documentos |
| `/api/openrouter/models` | GET | Listar modelos de OpenRouter |
| `/api/config` | GET | Ver configuración activa |

---

## Broadcast

El endpoint `POST /api/broadcast/good-morning` genera un mensaje personalizado con IA para cada cliente usando el contexto del bot (identidad, propuestas, etc.) y lo envía por WhatsApp con 4 segundos de pausa entre envíos para evitar spam.

```bash
# Enviar a todos los clientes registrados
curl -X POST http://localhost:3000/api/broadcast/good-morning

# Enviar a números específicos (solo si están en clients.json)
curl -X POST http://localhost:3000/api/broadcast/good-morning \
  -H "Content-Type: application/json" \
  -d '{ "phones": ["5493874497992"] }'
```

Respuesta:
```json
{
  "ok": true,
  "sent": 2,
  "failed": 0,
  "skipped": 0,
  "results": [...]
}
```

---

## Clientes (`config/clients.json`)

```json
[
  {
    "name": "Juan",
    "phone": "5491134567890",
    "company": "Empresa SRL",
    "knowledgeDocs": ["empresa.md"]
  }
]
```

> `clients.json` está en `.gitignore` — nunca se sube al repositorio.

---

## Solución de problemas

**Bot colgado / no muestra QR (Windows)**
```powershell
Get-Process chrome,node | Stop-Process -Force
Remove-Item .wwebjs_auth/session/SingletonLock -Force
```

**Error TLS en Windows con APIs externas**
Verificá que `.env` tenga `NODE_TLS_REJECT_UNAUTHORIZED=0`.

**OpenRouter no trae modelos**
El menú de inicio usa `https.request` nativo (no `fetch`) para respetar `rejectUnauthorized: false` en Windows. Si falla, verificá tu API key y conexión a internet.

**La IA no responde / falla**
El bot reintenta 3 veces con back-off progresivo (2s, 4s). Si los 3 intentos fallan, envía un mensaje genérico de disculpa al usuario.

---

## Desarrollo

```bash
npm run start:dev    # Hot reload con ts-node
npm run build        # Compilar a dist/
npm run lint         # ESLint
npm test             # Tests unitarios
```

---

## Licencia

MIT
