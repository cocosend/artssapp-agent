# Copilot instructions for artssapp-agent

## Mission
- Keep the repository stable, small, and easy to review.
- Prefer minimal, targeted changes over broad refactors.
- Preserve the current architecture and follow the patterns already used in the codebase.

## Working rules
- Use TypeScript/Next.js conventions already present in the repo.
- Treat GitHub tokens, API keys, and service credentials as secrets and never print them.
- Never modify `.env*` files or commit real secrets.
- Do not write directly to `main`; work in a short-lived branch such as `agent/...`, `fix/...`, or `chore/...`.
- Keep patches atomic and easy to reason about.
- When a fix changes behavior, prefer a small, conventional commit message such as `fix: ...`, `chore: ...`, or `docs: ...`.

## Validation
- Before finalizing a JS/TS change, run `npm run lint` and `npm run build` when the repo is in a workable state.
- If the fix is user-facing or risky, add or update tests where practical.
- Do not claim a fix is complete without validating the modified behavior.

## Automation expectations
- If the task involves repository maintenance, prefer semver-safe updates and minimal dependency bumps.
- Keep branch names short and descriptive: `fix/<issue>`, `chore/deps-update`, `agent/<timestamp>`.
- If a task results in repo changes, commit with a clear summary and push the branch when the change is ready.
- When a PR is useful, open it against `main` with a concise description.

## Safety guardrails
- Do not delete configuration or remove functionality without a clear reason.
- Avoid unrelated cleanup in the same patch.
- Prefer reversible changes and small scope.
- If the repository is blocked by missing credentials, document the blocker instead of hardcoding secrets.
