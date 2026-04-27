# BugMate — WhatsApp Bot Framework con IA

Bot de WhatsApp empresarial construido con NestJS + WhatsApp Web.js que soporta múltiples proveedores de IA, flujos conversacionales configurables por JSON, sistema de conocimiento vectorial (RAG), motor de campañas con base de datos y CLI de administración.

> Basado en [ignaciobecher/bug-mate](https://github.com/ignaciobecher/bug-mate) — extendido con OpenRouter, persistencia SQLite, motor de campañas profesional, opt-outs y CLI extendida.

---

## Características Principales

- **Múltiples proveedores de IA:** Gemini, Ollama (local) y OpenRouter — switcheable en caliente.
- **Persistencia Robusta (SQLite):** Base de datos para clientes, sistema de bajas (opt-out), logs de campañas y conocimiento vectorial.
- **Motor de Campañas:** Creación, ejecución, previsualización y seguimiento de envíos masivos personalizados con IA.
- **Sistema de Bajas (Opt-out):** Gestión automática de números que no desean recibir mensajes (vía API o comando WhatsApp).
- **CLI de Administración:** Herramienta de consola para gestionar clientes, campañas, bajas y ejecutar "skills" de IA.
- **RAG (Retrieval-Augmented Generation):** Búsqueda vectorial sobre documentos propios para respuestas precisas.
- **Comandos Globales Inteligentes:** Comandos como `menu`, `cancelar`, `salir` y reanudación automática si el usuario escribe tras una pausa.
- **Soporte Windows:** Configuraciones nativas para evitar errores TLS y bloqueos de proceso en entornos Windows.

---

## Requisitos

- Node.js 20+
- Google Chrome / Chromium (para Puppeteer)
- Una API key de Gemini o OpenRouter
- SQLite3 instalado en el sistema

---

## Instalación

```bash
git clone <tu-repo>
cd bug-mate
npm install
```

Configuración inicial:

```bash
cp .env.example .env
cp config/bot.config.example.json config/bot.config.json
cp config/campaigns.example.json config/campaigns.json
```

---

## Uso

```bash
npm run build        # Compilar
npm run start:dev    # Iniciar en modo desarrollo
```

Al iniciar, aparece un **menú interactivo** para elegir el modelo de IA. Luego, escaneá el QR con WhatsApp.

---

## Motor de Campañas

El bot incluye un potente sistema de campañas definido en `config/campaigns.json`.

### Flujo de una campaña:
1. **Definición:** Se configura el prompt y la lógica en el JSON.
2. **Importación:** Los clientes se registran en la DB (vía API o CLI).
3. **Ejecución:** Se lanza la campaña (dry-run para probar, o real).
4. **Seguimiento:** Cada envío queda registrado en la tabla `campaign_runs`.

---

## CLI de Administración

La herramienta `npm run cli` permite gestionar el bot sin usar la API directamente. 

> **Nota:** El servidor (`npm run start:dev`) debe estar corriendo en otra terminal.

### Comandos disponibles:

| Comando | Descripción |
|---|---|
| `status` | Estado del bot y proveedor actual |
| `clients` | Listar todos los clientes en la DB |
| `clients add <tel> <nombre>` | Registrar un nuevo cliente |
| `campaigns` | Listar campañas configuradas |
| `campaigns run <id>` | Ejecutar una campaña (usa `--dry-run` para probar) |
| `campaigns runs <id>` | Ver historial de envíos de una campaña |
| `optouts` | Ver lista de números en lista negra |
| `optouts add <tel>` | Agregar número a lista negra manualmente |
| `skills` | Listar y ejecutar habilidades de IA especializadas |

---

## Estructura de Datos (SQLite)

El sistema utiliza `data/bugmate.sqlite` con las siguientes tablas:
- `clients`: Datos de contacto y preferencias.
- `opt_outs`: Números que solicitaron la baja.
- `campaign_runs`: Log histórico de cada mensaje enviado por campaña.
- `knowledge_vectors`: (En `knowledge.sqlite`) Vectores para búsqueda semántica.

---

## API REST (Endpoints Clave)

| Endpoint | Método | Acción |
|---|---|---|
| `/api/clients` | GET/POST | Gestión de base de datos de clientes |
| `/api/campaigns` | GET/POST | Configuración de campañas |
| `/api/campaign-runs` | POST | Disparar una campaña |
| `/api/opt-outs` | GET/POST | Gestionar lista negra |
| `/api/pause` | POST | Pausar atención de IA para un número |
| `/api/resume` | POST | Reanudar atención (borra la pausa) |

---

## Comandos desde WhatsApp

### Para Usuarios:
- `menu`: Vuelve al menú principal.
- `cancelar` / `salir`: Cancela el flujo actual.
- `baja` (en respuesta a campaña): Se auto-registra en la lista de opt-out.

### Para el Administrador (en el Grupo de Control):
- `!status`: Resumen del sistema.
- `!paused`: Lista de chats pausados manualmente.
- `!sessions`: Sesiones activas.

---

## Desarrollo

```bash
npm run start:dev    # Hot reload
npm run lint         # Control de calidad
npm test             # Ejecutar tests
```

---

## Licencia

MIT
