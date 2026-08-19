# Resume investigator example

This example receives verified Greenhouse webhook ingress at
`/channels/greenhouse/webhook`, dispatches each application to a durable Flue
agent, and gives that agent narrow evidence tools for resume contacts,
employment dates, GitHub metadata, and optional UserCheck email reputation.

The agent is read-only. It emits allowlisted observations for human review and
never makes a hire or reject decision.

## What It Demonstrates

- Flue 2.0 nightly agent functions and hooks.
- A provider-specific channel with HMAC verification over the unconsumed body.
- Durable `kind: 'signal'` dispatch, one conversation per application.
- Trusted candidate scoping through `initialData`; tool arguments cannot select
  another candidate, email address, or GitHub account.
- Structured Valibot tool results with a Markdown agent report.
- Workers AI through Cloudflare AI Gateway.
- A progressively disclosed Agent Skill plus always-on policy in the system
  prompt.

## Output Contract

The boundaries intentionally use different formats:

- Greenhouse and demo routes return a JSON Flue admission receipt.
- Evidence tools return validated JSON for model consumption.
- The agent writes a Markdown report into its durable conversation.
- `GET /agents/resume-investigator/:id` returns Flue's JSON conversation
  snapshot, whose assistant text part contains that Markdown report.

## Setup

Requirements: Node.js 22.19 or newer and a Cloudflare account with Workers AI.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Set strong local values for `GREENHOUSE_WEBHOOK_SECRET` and `ADMIN_TOKEN` in
`.dev.vars`. `GITHUB_TOKEN` is optional but raises GitHub's API rate limit.
`USERCHECK_API_KEY` is optional; without it the email tool returns
`status=not_configured`. When configured, the candidate's email is sent to
[UserCheck](https://www.usercheck.com/).

The model uses `cloudflare/@cf/zai-org/glm-4.7-flash`, which is available on
the Workers Free plan and supports function calling. Flue routes it through
the `default` AI Gateway configured in `wrangler.jsonc`. Gateway payload
logging is disabled because candidate prompts contain personal data.

## Run a Synthetic Investigation

The `/demo` route uses bundled synthetic fixtures and requires the admin token:

```bash
curl -X POST http://localhost:5173/demo/clean \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl http://localhost:5173/agents/resume-investigator/demo-1001 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Use `demo/suspicious` and conversation `demo-1002` for the fixture containing
contact and employment-date conflicts.

## Run the Greenhouse Channel

With the dev server running, send the bundled event using the secret in
`.dev.vars`:

```bash
npm run demo:webhook
```

The script signs the exact fixture bytes as `Signature: sha256 <hex>`. A valid
`new_candidate_application` delivery returns `202` after durable dispatch
admission; model work continues asynchronously. Read its report at:

```bash
curl http://localhost:5173/agents/resume-investigator/greenhouse-1003 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

The example accepts Greenhouse `ping` and ignores other action types. The
application id is a create-only conversation key, so a signed retry returns a
successful duplicate response without starting a second investigation. Bodies
are capped at 256 KiB before buffering. The fixture's optional `resume_text`
field is an educational enrichment, not a standard Greenhouse webhook
guarantee. A production integration should fetch and extract authorized resume
attachments before dispatch.

## Rules

The agent can emit only:

- `resume_contact_mismatch`
- `employment_date_impossible`
- `employment_overlap`
- `disposable_email`
- `github_profile_invalid`
- `github_new_empty_profile`
- `github_all_forks`

Missing API data is reported under `Unknowns`, never converted into a finding.
The `useAgentFinish` hook sends the model back to work if it tries to finish an
initial investigation before calling every evidence tool.

## Verify and Deploy

```bash
npm run check
npx wrangler deploy --dry-run
npm run deploy
```

Set deployed secrets interactively before deployment:

```bash
npx wrangler secret put GREENHOUSE_WEBHOOK_SECRET
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put USERCHECK_API_KEY
```

`GITHUB_TOKEN` and `USERCHECK_API_KEY` may be omitted.

## Flue Nightly

This example deliberately tracks the npm `nightly` tag for `@flue/runtime`,
`@flue/vite`, and `@flue/cli`. Use the installed CLI as the API source of truth:

```bash
npx flue docs search "custom tools"
npx flue docs read guide/tools
```

Nightly documentation: [nightly.flueframework.com](https://nightly.flueframework.com/).

This is an educational example built around synthetic data. Employment
screening systems require legal review, access controls, retention limits,
auditing, bias evaluation, and human decision-making beyond this recipe.
