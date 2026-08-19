import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

const UserCheckSchema = v.object({
	disposable: v.boolean(),
	public_domain: v.boolean(),
	relay_domain: v.boolean(),
	role_account: v.boolean(),
	spam: v.boolean(),
	mx: v.nullable(v.boolean()),
	did_you_mean: v.nullable(v.string()),
});
const StatusSchema = v.picklist(['ok', 'not_configured', 'unavailable']);
const MAX_EMAILS = 3;

export function createUserCheckTool(emails: string[], apiKey?: string) {
	return defineTool({
		name: 'check_email_reputation',
		description: 'Check up to three candidate emails bound to this investigation with UserCheck.',
		output: v.object({
			status: v.picklist(['ok', 'partial', 'not_configured', 'unavailable']),
			results: v.array(
				v.object({
					email: v.string(),
					status: StatusSchema,
					disposable: v.optional(v.boolean()),
					publicDomain: v.optional(v.boolean()),
					relayDomain: v.optional(v.boolean()),
					roleAccount: v.optional(v.boolean()),
					spam: v.optional(v.boolean()),
					mx: v.optional(v.nullable(v.boolean())),
					didYouMean: v.optional(v.nullable(v.string())),
				}),
			),
			truncated: v.boolean(),
		}),
		async run({ signal }) {
			return checkEmailsWithUserCheck(emails, apiKey, fetch, signal);
		},
	});
}

export async function checkEmailsWithUserCheck(
	emails: string[],
	apiKey: string | undefined,
	fetcher: typeof fetch,
	signal?: AbortSignal,
) {
	const selected = emails.slice(0, MAX_EMAILS);
	if (selected.length === 0 || !apiKey) {
		return { status: 'not_configured' as const, results: [], truncated: emails.length > MAX_EMAILS };
	}
	const results = [];
	for (const email of selected) {
		results.push({ email, ...(await checkEmailWithUserCheck(email, apiKey, fetcher, signal)) });
	}
	const available = results.filter((result) => result.status === 'ok').length;
	return {
		status:
			available === results.length
				? ('ok' as const)
				: available > 0
					? ('partial' as const)
					: ('unavailable' as const),
		results,
		truncated: emails.length > MAX_EMAILS,
	};
}

export async function checkEmailWithUserCheck(
	email: string | undefined,
	apiKey: string | undefined,
	fetcher: typeof fetch,
	signal?: AbortSignal,
) {
	if (!email || !apiKey) return { status: 'not_configured' as const };
	try {
		const timeout = AbortSignal.timeout(5_000);
		const response = await fetcher(`https://api.usercheck.com/email/${encodeURIComponent(email)}`, {
			headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		});
		if (!response.ok) return { status: 'unavailable' as const };
		const parsed = v.safeParse(UserCheckSchema, await response.json());
		if (!parsed.success) return { status: 'unavailable' as const };
		return {
			status: 'ok' as const,
			disposable: parsed.output.disposable,
			publicDomain: parsed.output.public_domain,
			relayDomain: parsed.output.relay_domain,
			roleAccount: parsed.output.role_account,
			spam: parsed.output.spam,
			mx: parsed.output.mx,
			didYouMean: parsed.output.did_you_mean,
		};
	} catch {
		return { status: 'unavailable' as const };
	}
}
