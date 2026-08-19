import { env } from 'cloudflare:workers';
import { dispatch, setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono, type MiddlewareHandler } from 'hono';
import { ResumeInvestigator } from './agents/resume-investigator.ts';
import { channel as greenhouse } from './channels/greenhouse.ts';
import { getFixture } from './fixtures/candidates.ts';
import { bearerToken, secureEqual } from './security.ts';

setProvider(
	cloudflareBindingProvider({
		binding: env.AI,
		gateway: {
			id: process.env.AI_GATEWAY_ID ?? 'default',
			// Candidate prompts contain PII. Keep Gateway controls without storing payload logs.
			collectLog: false,
			metadata: { application: 'flue-resume-investigator' },
		},
	}),
);

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));
app.route('/channels/greenhouse', greenhouse.route());

const requireAdmin: MiddlewareHandler = async (c, next) => {
	const expected = process.env.ADMIN_TOKEN;
	const provided = bearerToken(c.req.header('Authorization'));
	if (!expected || !provided || !(await secureEqual(provided, expected))) {
		return c.json({ error: 'unauthorized' }, 401);
	}
	await next();
};

app.use('/demo/*', requireAdmin);
app.post('/demo/:fixtureId', async (c) => {
	const candidate = getFixture(c.req.param('fixtureId'));
	if (!candidate) return c.json({ error: 'fixture not found' }, 404);

	const receipt = await dispatch(ResumeInvestigator, {
		id: `demo-${candidate.applicationId}`,
		initialData: candidate,
		message: {
			kind: 'signal',
			type: 'demo.application.submitted',
			body: 'Investigate this synthetic candidate application using the available evidence tools.',
			attributes: { applicationId: candidate.applicationId, candidateId: candidate.candidateId },
			tagName: 'application-event',
		},
	});
	return c.json(receipt, 202);
});

app.use('/agents/resume-investigator/*', requireAdmin);
app.route('/agents/resume-investigator', createAgentRouter(ResumeInvestigator));

export default app;
