# Arts Agent

iPhone-first multi-model coding agent for one controlled repository.

Architecture:

iPhone PWA → Arts Agent API (Supabase Edge or Next.js) → DeepSeek / Gemini / OpenAI → Supabase run memory → GitHub branch/atomic commit/PR. Vercel is optional for the web UI.

## What is implemented

- Multi-model provider selector: DeepSeek, Gemini, OpenAI.
- Repository-aware agent context from `cocosend/artssapp-agent`.
- Structured agent plans with safe path validation.
- Preview mode: the model can prepare file changes without writing them.
- Execution mode: the server creates an `agent/*` branch and writes all requested files in one atomic Git commit.
- Optional pull request creation.
- Direct Supabase Edge runtime for the agent API, independent of Vercel.\n- Optional Vercel preview deployment from the Next.js runtime.
- Supabase persistence for sessions, messages, runs, and run events.
- iPhone-safe UI with execution stages and result metadata.
- GitHub Actions lint/build workflow.
- Non-secret health diagnostics at `GET /api/health`.

The execution engine never writes directly to `main`.

## Environment

Copy `.env.example` to `.env.local` locally. Configure the corresponding server-side variables in the runtime you use (Supabase Edge and/or Vercel). Never commit real secrets.

Required for AI:
- `DEEPSEEK_API_KEY` or `GEMINI_API_KEY` or `OPENAI_API_KEY`

Required for GitHub execution:
- `GITHUB_TOKEN`
- `GITHUB_REPO=cocosend/artssapp-agent`
- `AGENT_EXECUTION_ENABLED=true`

Optional for persistence:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional for agent-triggered Vercel previews:
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_NAME=artssapp-agent`

## Run locally

```bash
npm install
npm run lint
npm run build
npm run dev
```

## Agent commands

Examples:

- `Проаналізуй проєкт` — read-only analysis.
- `Зроби iPhone UI і закоміть` — edit files and create an agent branch + atomic commit.
- `Виправ помилку та створи PR` — edit, commit, and open a PR.
- `Зроби preview deploy` — edit, commit, and trigger a Vercel preview when Vercel credentials are configured.

Production deployment is intentionally blocked until an agent branch is merged. This prevents an unreviewed branch from being published as production.

## Security

The runtime blocks `.env` paths, parent-directory traversal, and secret material in the model's requested file set. Keep service-role/API tokens server-side only and use least-privilege GitHub permissions.

`/api/health` reports only whether integrations are configured; it never returns secret values.


## Private Agent API

The app exposes a versioned API under `/api/v1`:

- `GET /api/v1/health` — health/capability status.
- `POST /api/v1/agent` — run an authenticated coding-agent task.
- `GET /api/openapi` — machine-readable OpenAPI document.

Browser access uses the private login at `/login` and an HTTP-only session cookie. Server-to-server API access uses the `x-agent-service-key` header. Set a dedicated `AGENT_SERVICE_KEY`; `SUPABASE_SERVICE_ROLE_KEY` remains a compatibility fallback during migration.

The same API is also exposed through the Supabase Edge gateway:
`https://hyvsmtxewxpfnlzfjvca.supabase.co/functions/v1/arts-agent-api`.
The gateway accepts GET health checks and authenticated POST requests.

Required execution secret:
`AGENT_ACCESS_PASSWORD`.

Keep `AGENT_EXECUTION_ENABLED=false` until the selected runtime has its AI provider key, `GITHUB_TOKEN`, and service authentication configured. Then enable execution and test with a small branch/PR task.
