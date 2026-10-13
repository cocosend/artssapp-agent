# ARTSS ONE — canonical workspace and deployment map

Status: verified inventory (2026-10-14). This is an operational source of truth, not an instruction to destroy connected resources.

## Canonical services

| Role | Canonical resource | Notes |
| --- | --- | --- |
| AI agent frontend + Next.js API | `cocosend/artssapp-agent` -> Vercel `artssapp-agent` | [GitHub](https://github.com/cocosend/artssapp-agent) · [Vercel](https://vercel.com/artssby-apps/artssapp-agent) · `main` is the release branch |
| Shared AI agent persistence + Edge API | Supabase `ARTSSAGENTSSBOT`, ref `hyvsmtxewxpfnlzfjvca` | [Dashboard](https://supabase.com/dashboard/project/hyvsmtxewxpfnlzfjvca) · single existing database, RLS on six public agent tables |
| DJ performance app | `cocosend/artss-djs` -> Vercel `artss-djs` | [GitHub](https://github.com/cocosend/artss-djs) · [App](https://artss-djs.vercel.app) · production is a dependency-free static Web Audio app |
| Optional separate Eve agent | `cocosend/artssgents-agent` -> Vercel `artssgents` | Separate Eve runtime and chat implementation; do not delete on the assumption it is a copy |
| Duplicate Vercel frontend | Vercel `artssgent` | Same GitHub repo `cocosend/artssapp-agent` as canonical agent; pause requested 2026-10-14. Retain rollback until hostname traffic and envs are audited |

Vercel owner/team: `ARTSSBYAPPS`, `team_1dHFMtS9AoIFV64hAftjbcvB`.
Canonical AI Vercel project ID: `prj_LclUIsfqljGOjbYJmAXLxYkVv6xS`.
DJ Vercel project ID: `prj_DdGaTH7aCKZSGbHCNKfUEJYhH0ft`.
Do not copy credential values, project service-role secrets, browser tokens, or user messages into this document.

## Single control plane (architectural contract)

- Treat this repository's authenticated agent API as the control plane for code tasks, model routing, GitHub branch/PR creation, and deployment reporting.
- A ChatGPT conversation is a user interface to connected services, **not** a durable cross-chat event bus or an always-running worker. Other chats and external services cannot automatically post responses to this chat without an independently deployed, authenticated integration.
- Route only explicit DJ-code tasks to the DJ repository; the DJ app must not acquire a second mixer, duplicate audio engines, or direct browser access to privileged Supabase keys.
- Keep Supabase as one existing persistence backend; do not recreate the database or independently copy its tables.
- Consider the Eve project a specialist runtime until an audited migration proves feature parity, confirms user/session data export, and verifies that its endpoints are no longer used.
- Project inventory from the linked Vercel team includes older `artsocksss` targets and multiple `Techno-ej` deployments. They are **not** confirmed duplicates: compare domains, source commits, environment keys (names only), and active traffic before consolidation.
- Keep a single production domain/branch for each *functionally distinct* application, not a single repository for unrelated runtime stacks.

## Safe execution order

1. Confirm authenticated connector scope, GitHub repository access, canonical production URLs and last healthy deployments.
2. Inventory source trees, environment **variable names only**, Supabase functions/migrations, runtime endpoints and data ownership.
3. Apply minimal changes on a branch, run lint/typecheck/tests/build, and verify a Vercel preview for that exact commit.
4. Merge with a protected, reviewed main branch; verify production readiness, error logs and rollback candidate.
5. Pause duplicate Vercel sites before considering removal. Preserve unique domains, content, data, billing integrations, secrets and audit trails.
6. Delete an obsolete resource **only after** verified equivalence, backup/export, dependency checks and a complete rollback plan.

## DJ Creator source variants

The currently deployed canonical static DJ app (`cocosend/artss-djs`) is not the same implementation as the separate React/Vite `ARTSS-DJ-Creator-V1-Final` archive. The optimized React source has one Web Audio engine, 16 pads, 40 genre presets, a tested transport cancellation path and offline WAV render, but still requires a full dependency-backed build and mobile Safari interaction tests before it can replace the static production version.

## Current known operational caveats

- AI provider availability and GitHub code-execution authorization must be verified from the running `/api/health` endpoint, not inferred solely from repo docs or configured environment-variable names.
- Agent autoexecution is deliberately gated by `AGENT_EXECUTION_ENABLED` and authenticated GitHub write access. Never disable auth or enable public writes to bypass connector problems.
- Supabase Edge functions with `verify_jwt=false` require separate application-level authentication audits; no assumption of safety based on project membership.
- No background execution is implied by this document or the presence of a chat plugin. Scheduled checks need an authorized scheduler with persistent connector access.

_Last reviewed: 2026-10-14._
