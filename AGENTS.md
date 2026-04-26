# Repository Guidelines

## Project Overview

Bug-Mate is a NestJS/TypeScript WhatsApp support bot. Its behavior is intended to be mostly configurable through JSON files, especially `config/bot.config.json`, `config/clients.json`, and `config/knowledge.json`.

Core areas:

- `src/modules/messaging/`: WhatsApp adapter and control-group commands.
- `src/modules/bot/`: conversation routing, conditional flows, escalation, and validation.
- `src/modules/config/`: config loading, schemas, and TypeScript config types.
- `src/modules/ai/`: Gemini, Ollama, and OpenRouter providers.
- `src/modules/knowledge/`: FAQ and vector-search knowledge service.
- `src/modules/session/`: in-memory conversation session state.
- `src/cli/`: terminal CLI for bot control.

## Commands

Run commands from `bug-mate/`.

- Install dependencies: `npm install`
- Build: `npm run build`
- Unit tests: `npm test`
- E2E tests: `npm run test:e2e`
- Format: `npm run format`
- Lint: `npm run lint`
- Dev server: `npm run start:dev`
- CLI: `npm run cli -- status`
- OpenRouter models: `npm run cli -- openrouter models`

## Local Files and Secrets

Do not commit or expose local secrets or runtime state:

- `.env`
- `config/clients.json`
- WhatsApp auth/cache folders: `.wwebjs_auth/`, `.wwebjs_cache/`
- Generated data such as `data/knowledge.sqlite`
- Build output: `dist/`
- Dependencies: `node_modules/`

Use `.env.example`, `config/clients.example.json`, and `config/bot.config.example.json` as safe references when possible.

## Implementation Notes

- Prefer changing JSON configuration for bot behavior when the requested outcome can be achieved without code changes.
- Keep flow changes consistent with the conditional-flow DSL documented in `README.md`.
- When modifying step types or flow behavior, update both runtime handling and the relevant types under `src/modules/config/types/`.
- Preserve the existing NestJS dependency-injection style and provider tokens from `src/modules/core/tokens/injection-tokens.ts`.
- OpenRouter uses `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and OpenRouter model IDs in `config/bot.config.json` (`ai.model` and `ai.embeddingModel`).
- The app uses TypeScript with `module`/`moduleResolution` set to `nodenext`.

## Verification

For code changes, run the narrowest useful check first, then broader checks when the change touches shared bot behavior:

- Config-only changes: validate JSON syntax and run `npm run build` when practical.
- Service or module changes: run `npm test`.
- API or app wiring changes: run `npm run test:e2e` if relevant.

Note: this repository may require `git config --global --add safe.directory D:/sistemas_git/bot_oscar/bug-mate` before Git commands work on this machine.
