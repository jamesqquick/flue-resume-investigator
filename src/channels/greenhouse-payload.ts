import * as v from 'valibot';
import type { Candidate } from '../candidate.ts';
import { verifyGreenhouseSignature } from '../security.ts';

const ShortText = v.pipe(v.string(), v.maxLength(200));
const ContactSchema = v.object({ value: v.pipe(v.string(), v.maxLength(2_048)) });
const EmploymentInputSchema = v.object({
	company_name: v.optional(ShortText, ''),
	title: v.optional(ShortText, ''),
	start_date: v.optional(v.pipe(v.string(), v.maxLength(32)), ''),
	end_date: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(32))), null),
});
const CandidateInputSchema = v.object({
	id: v.union([v.string(), v.number()]),
	first_name: v.optional(ShortText, ''),
	last_name: v.optional(ShortText, ''),
	email_addresses: v.optional(v.pipe(v.array(ContactSchema), v.maxLength(10)), []),
	phone_numbers: v.optional(v.pipe(v.array(ContactSchema), v.maxLength(10)), []),
	employments: v.optional(v.pipe(v.array(EmploymentInputSchema), v.maxLength(40)), []),
	social_media_addresses: v.optional(v.pipe(v.array(ContactSchema), v.maxLength(20)), []),
});
const PayloadSchema = v.object({
	application: v.object({
		id: v.union([v.string(), v.number()]),
		candidate: CandidateInputSchema,
	}),
	resume_text: v.optional(v.pipe(v.string(), v.maxLength(100_000)), ''),
});
const EnvelopeSchema = v.object({ action: v.string(), payload: v.optional(v.unknown()) });

type WebhookResult =
	| { ok: false; status: 400 | 401 | 503; error: string }
	| { ok: true; action: string; candidate?: Candidate };

export async function parseGreenhouseWebhook(
	rawBody: string,
	signature: string | undefined,
	secret: string | undefined,
): Promise<WebhookResult> {
	if (!secret) return { ok: false, status: 503, error: 'webhook secret is not configured' };
	if (!(await verifyGreenhouseSignature(rawBody, signature, secret))) {
		return { ok: false, status: 401, error: 'invalid signature' };
	}

	let json: unknown;
	try {
		json = JSON.parse(rawBody);
	} catch {
		return { ok: false, status: 400, error: 'invalid JSON' };
	}
	const envelope = v.safeParse(EnvelopeSchema, json);
	if (!envelope.success) return { ok: false, status: 400, error: 'invalid Greenhouse envelope' };
	if (envelope.output.action === 'ping') return { ok: true, action: 'ping' };
	if (envelope.output.action !== 'new_candidate_application') {
		return { ok: true, action: envelope.output.action };
	}

	const payload = v.safeParse(PayloadSchema, envelope.output.payload);
	if (!payload.success) return { ok: false, status: 400, error: 'invalid application payload' };
	const input = payload.output.application.candidate;
	const githubUsername =
		input.social_media_addresses
			.map((entry) => extractGitHubUsername(entry.value))
			.find((username) => username !== null) ?? null;

	return {
		ok: true,
		action: envelope.output.action,
		candidate: {
			applicationId: String(payload.output.application.id),
			candidateId: String(input.id),
			name: `${input.first_name} ${input.last_name}`.trim(),
			emails: input.email_addresses.map((entry) => entry.value),
			phones: input.phone_numbers.map((entry) => entry.value),
			resumeText: payload.output.resume_text,
			employments: input.employments.map((employment) => ({
				company: employment.company_name,
				title: employment.title,
				start: employment.start_date,
				end: employment.end_date,
			})),
			githubUsername,
			source: 'greenhouse',
		},
	};
}

function extractGitHubUsername(value: string): string | null {
	try {
		const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
		if (url.hostname.toLowerCase() !== 'github.com') return null;
		const username = url.pathname.split('/').filter(Boolean)[0];
		return username && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)
			? username
			: null;
	} catch {
		return null;
	}
}
