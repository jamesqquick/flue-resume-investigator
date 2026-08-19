import { describe, expect, it } from 'vitest';
import { readBoundedWebhookBody } from '../src/channels/webhook-body.ts';
import { bearerToken } from '../src/security.ts';

describe('HTTP security boundaries', () => {
	it('requires the Bearer authorization scheme', () => {
		expect(bearerToken('secret')).toBeUndefined();
		expect(bearerToken('Bearer secret')).toBe('secret');
		expect(bearerToken('bearer secret')).toBe('secret');
		expect(bearerToken('Bearer secret extra')).toBeUndefined();
	});

	it('rejects oversized streamed webhook bodies', async () => {
		const request = new Request('https://example.com/webhook', {
			method: 'POST',
			body: 'a'.repeat(11),
		});
		expect(await readBoundedWebhookBody(request, 10)).toEqual({ ok: false });
	});
});
