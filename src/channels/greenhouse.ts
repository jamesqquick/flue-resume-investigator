import { AgentInstanceExistsError, createChannelRouter, dispatch } from '@flue/runtime';
import type { Handler } from 'hono';
import { ResumeInvestigator } from '../agents/resume-investigator.ts';
import { parseGreenhouseWebhook } from './greenhouse-payload.ts';
import { readBoundedWebhookBody } from './webhook-body.ts';

const webhook: Handler = async (c) => {
	const body = await readBoundedWebhookBody(c.req.raw);
	if (!body.ok) return c.json({ error: 'webhook body too large or invalid' }, 413);
	const parsed = await parseGreenhouseWebhook(
		body.text,
		c.req.header('Signature'),
		process.env.GREENHOUSE_WEBHOOK_SECRET,
	);
	if (!parsed.ok) return c.json({ error: parsed.error }, parsed.status);
	if (!parsed.candidate) return c.json({ accepted: false, action: parsed.action });

	try {
		const receipt = await dispatch(ResumeInvestigator, {
			id: `greenhouse-${parsed.candidate.applicationId}`,
			uid: null,
			initialData: parsed.candidate,
			message: {
				kind: 'signal',
				type: `greenhouse.${parsed.action}`,
				body: 'Investigate this candidate application using the available evidence tools.',
				attributes: {
					applicationId: parsed.candidate.applicationId,
					candidateId: parsed.candidate.candidateId,
				},
				tagName: 'greenhouse-event',
			},
		});
		return c.json(receipt, 202);
	} catch (error) {
		if (error instanceof AgentInstanceExistsError) {
			return c.json({ accepted: false, duplicate: true, uid: error.uid });
		}
		throw error;
	}
};

export const channel = {
	routes: [{ method: 'POST' as const, path: '/webhook', handler: webhook }],
	route() {
		return createChannelRouter(this.routes);
	},
};
