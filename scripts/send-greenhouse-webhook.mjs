import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const secret = process.env.GREENHOUSE_WEBHOOK_SECRET;
if (!secret) throw new Error('GREENHOUSE_WEBHOOK_SECRET is required.');

const body = await readFile(new URL('../fixtures/greenhouse-new-candidate.json', import.meta.url), 'utf8');
const signature = createHmac('sha256', secret).update(body).digest('hex');
const baseUrl = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
const response = await fetch(`${baseUrl}/channels/greenhouse/webhook`, {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		Signature: `sha256 ${signature}`,
	},
	body,
});

console.log(response.status, await response.text());
if (!response.ok) process.exitCode = 1;
