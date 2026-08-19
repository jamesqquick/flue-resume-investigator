# AGENTS.md

This is a [Flue nightly](https://nightly.flueframework.com/) project: agents are TypeScript functions.

## Layout

- `src/agents/` — agent modules. A module whose first line is the `'use agent'` directive exports agents: every exported capitalized function is one, and the function name is its durable identity.
- `src/channels/` — verified provider ingress and payload normalization.
- `src/tools/` — narrow model-callable capabilities with structured results.
- `src/skills/` — progressively disclosed agent procedures.
- `src/app.ts` — the route map; every route is mounted here explicitly.
- `src/cloudflare.ts` — Worker-level exports and non-HTTP handlers.
- `wrangler.jsonc` — Worker config; every agent needs a Durable Object migration entry.

## Commands

- `npm run dev` — run the Cloudflare-targeted agent and webhook locally.
- `npm run demo:webhook` — send the signed synthetic Greenhouse fixture.
- `npm run deploy` — build and deploy the Worker.
- `npm run check:types` — typecheck.
- `npm test` — run deterministic tool and webhook tests.
- `npx flue docs search <query>` — search the Flue docs from the terminal (then `flue docs read <path>`).
- `npx flue add` — list blueprints for adding channels, sandboxes, and databases.
