# ARTSS ONE — canonical workspace and deployment map

Status: verified inventory (2026-10-23). This is an operational source of truth, not an instruction to destroy connected resources.

## Canonical services

| Role | Canonical resource | Notes |
| --- | --- | --- |
| AI agent frontend + Next.js API | `cocosend/artssapp-agent` -> Vercel `artssapp-agent` | [GitHub](https://github.com/cocosend/artssapp-agent) · [Vercel](https://vercel.com/artssby-apps/artssapp-agent) · `main` is the release branch |
| Shared AI agent persistence + Edge API | Supabase `ARTSSAGENTSSBOT`, ref `hyvsmtxewxpfnlzfjvca` | [Dashboard](https://supabase.com/dashboard/project/hyvsmtxewxpfnlzfjvca) · single existing database, RLS on six public agent tables |
| DJ performance app | `cocosend/artss-djs` -> Vercel `artss-djs` | [GitHub](https://github.com/cocosend/artss-djs) · [App](https://artss-djs.vercel.app) · production is a built Web Audio PWA from canonical `main`; `native/` remains experimental |
| Optional separate Eve agent | `cocosend/artssgents-agent` -> Vercel `artssgents` | Separate Eve runtime and chat implementation; do not delete on the assumption it is a copy |
| Duplicate Vercel frontend | Vercel `artssgent` | Same GitHub repo `cocosend/artssapp-agent` as canonical agent; new builds paused 2026-10-23. Retain existing production rollback/domain until hostname traffic and envs are audited |

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

The canonical, deployed `cocosend/artss-djs` app is a TypeScript/Web Audio PWA built via `npm run build`. Its v32.2 performance engine and CHROMA design are not the same implementation as the separate React/Vite `ARTSS-DJ-Creator-V1-Final` archive. The separate archive and experimental `native/` source have not been substituted for the production engine.

## Current known operational caveats

- AI provider availability and GitHub code-execution authorization must be verified from the running `/api/health` endpoint, not inferred solely from repo docs or configured environment-variable names.
- Agent autoexecution is deliberately gated by `AGENT_EXECUTION_ENABLED` and authenticated GitHub write access. Never disable auth or enable public writes to bypass connector problems.
- Supabase Edge functions with `verify_jwt=false` require separate application-level authentication audits; no assumption of safety based on project membership.
- No background execution is implied by this document or the presence of a chat plugin. Scheduled checks need an authorized scheduler with persistent connector access.

_Last reviewed: 2026-10-23._


## Historical pre-cutover audit — 2026-10-23

Checked the connected GitHub, Vercel and Supabase inventories (configuration **names only**, no secret values).

| Service | Confirmed state | Decision |
| --- | --- | --- |
| AI control plane | `cocosend/artssapp-agent` main `69502842`; Vercel `artssapp-agent` production READY at the same SHA; main protected, four branches total | **KEEP**; canonical control plane and branch. |
| AI Vercel duplicate | `artssgent` deployed the same `69502842` main SHA; it has `FLAGS_SECRET` configured separately | **REVIEW / PAUSE** duplicate deploys only after hostname traffic, secret references and rollback checks; do not delete blindly. |
| DJ source | `cocosend/artss-djs` main `89118b6b` is v30, with 39 listed branches | **KEEP**; audit 38 non-main branches before pruning. |
| DJ production | `artss-djs` production has READY deployment `ca9d1989` from `release/nexus30-performance-studio` (v32), not current main | **FIX BRANCH DRIFT** before assigning main to production. Do not accidentally downgrade the working engine. |
| DJ redesign | PR #57 `feat/artss-chroma-live32-20261023`, targeted at the v32 release branch | Verify exact-sha CI, Chromium/WebKit and Vercel preview before production promotion. |
| Eve | `cocosend/artssgents-agent` ↔ Vercel `artssgents`; separate production runtime | **KEEP** until feature/data/session migration audit. |
| Supabase | `ARTSSAGENTSSBOT` (`hyvsmtxewxpfnlzfjvca`) ACTIVE_HEALTHY | **KEEP** one persistence system and its access controls. |
| Legacy Vercel | Four `Techno-ej` linked targets: `techno-ej`, `techno-yezh`, `texnoezh`, `texnoyizhak`; additional `artsocksss` apps and `artss-camera` | **AUDIT** first. Do not assume duplication. |

Canonical AI Vercel currently enforces SSO for all targets; public `/api/health` checks cannot substitute authenticated verification.
DJ and AI are two functionally distinct applications and should stay on separate repositories and domains.

### Exact cleanup gate
1. Save a rollback commit and last known READY production deployment; check domain traffic and outgoing integrations.
2. Compare env-key names and scopes (never publish values), migrations, storage keys, API consumers and domain bindings for each duplicate candidate.
3. Build and test the chosen DJ source with `npm run check`, native DSP test, mobile Chromium/WebKit and a READY Vercel deployment matching the exact commit.
4. Unify the DJ release history and protect one production branch; only then remove unmerged redundant refs after conflict and uniqueness checks.
5. Pause proved-duplicate deployments; delete or rename a resource only after feature parity, backup/export, consumer check and rollback.


## Canonical post-cutover verification — 2026-10-23

- Agent audit PR [#56](https://github.com/cocosend/artssapp-agent/pull/56) was merged to protected `main` at `d1d84595f561a7508ed13ac7d6cfa9142454490f` after exact-SHA Vercel preview READY, CI and CodeQL passed. Production authentication and execution gates remain intact.
- DJ visual PR [#57](https://github.com/cocosend/artss-djs/pull/57) created the CHROMA LIVE32 production design at `13059f47b04620af848e0c47b9dc63befb24f2bd`.
- DJ integration PR [#58](https://github.com/cocosend/artss-djs/pull/58) merged `main` (v30) and v32 release ancestry into a new verified, merge-commit-backed `main`: `d930db91d60ba7b1e1b149a1ab825c704aff14a4`. Its tree SHA `010f863bcb64f8e7ffeb71e9045d1ab221291a9d` matches the tested CHROMA 32.2 production tree exactly. PR #49 was closed automatically by the ancestry merge.
- Vercel DJ production deployment `dpl_EwETG44FRRNNL6ZmT5BrasrHY3cF` is READY from `main`. Stable public alias `https://artss-djs.vercel.app` was explicitly assigned to that deployment; previous READY production `dpl_7j5uW4RWTDM8oDfUiVZGcVbBVBJN` remains available for rollback.
- Extra Vercel project `artssgent` now ignores all new build requests and has preview deployments disabled; its previous production deployment and `FLAGS_SECRET`-only env configuration were preserved. It is **not deleted** pending consumer/hostname traffic audit.
- Six agent tables in the canonical Supabase project `hyvsmtxewxpfnlzfjvca` were checked live and all had RLS enabled. Nothing was cloned or migrated.
- DJ alternative refs must be evaluated for unpublished code before cleanup. Three earlier refs were found fully contained in the old release history (`fix/audio-v20-2-clean-gain-staging-envelope-timing`, `release/nexus29-neon-fidelity`, `review/approved-v8-audio-baseline`); deletion is deferred until branch/PR and recovery references are audited. Legacy `Techno-ej`-linked Vercel projects have distinct domains/configurations and are not assumed duplicates.

### Remaining controlled work

1. Complete device-specific audio latency, interruption and installed PWA checks on physical iOS/Android (CI browser emulation is not a substitute).
2. Review agent authenticated `/api/health` and model routing with authorized sessions before claiming all AI providers work end-to-end.
3. Audit DNS/traffic and integrations before deleting `artssgent` or four old `Techno-ej` target sites; do not purchase, transfer or destroy domains merely to change their display names.
4. Preserve the former DJ release branch and old READY deployment until an independently verified rollback path is documented.
