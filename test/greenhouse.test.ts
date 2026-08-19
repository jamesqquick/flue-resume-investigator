import { describe, expect, it } from 'vitest';
import { parseGreenhouseWebhook } from '../src/channels/greenhouse-payload.ts';

const secret = 'test-secret';
const body = JSON.stringify({
	action: 'new_candidate_application',
	payload: {
		application: {
			id: 1001,
			candidate: {
				id: 2001,
				first_name: 'Casey',
				last_name: 'Example',
				email_addresses: [{ value: 'casey@example.com' }],
				phone_numbers: [{ value: '+1 415 555 0100' }],
				employments: [],
				social_media_addresses: [{ value: 'https://github.com/octocat' }],
			},
		},
		resume_text: 'Casey Example casey@example.com +1 415 555 0100',
	},
});

describe('Greenhouse channel', () => {
	it('verifies and normalizes a signed application event', async () => {
		const signature = await sign(body, secret);
		const result = await parseGreenhouseWebhook(body, `sha256 ${signature}`, secret);
		expect(result).toMatchObject({
			ok: true,
			action: 'new_candidate_application',
			candidate: { applicationId: '1001', candidateId: '2001', githubUsername: 'octocat' },
		});
	});

	it('rejects an invalid signature before parsing', async () => {
		expect(await parseGreenhouseWebhook(body, `sha256 ${'0'.repeat(64)}`, secret)).toMatchObject({
			ok: false,
			status: 401,
		});
	});

	it('selects a valid GitHub profile after malformed social URLs', async () => {
		const value = JSON.parse(body);
		value.payload.application.candidate.social_media_addresses.unshift({ value: 'https://notgithub.com/nope' });
		const modified = JSON.stringify(value);
		const result = await parseGreenhouseWebhook(modified, `sha256 ${await sign(modified, secret)}`, secret);
		expect(result).toMatchObject({ ok: true, candidate: { githubUsername: 'octocat' } });
	});

	it('rejects employment arrays beyond the bounded analysis limit', async () => {
		const value = JSON.parse(body);
		value.payload.application.candidate.employments = Array.from({ length: 41 }, () => ({
			company_name: 'Example', title: 'Engineer', start_date: '2020-01', end_date: '2021-01',
		}));
		const modified = JSON.stringify(value);
		const result = await parseGreenhouseWebhook(modified, `sha256 ${await sign(modified, secret)}`, secret);
		expect(result).toMatchObject({ ok: false, status: 400 });
	});
});

async function sign(value: string, keyValue: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(keyValue),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
