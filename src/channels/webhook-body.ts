export const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function readBoundedWebhookBody(
	request: Request,
	maxBytes = MAX_WEBHOOK_BYTES,
): Promise<{ ok: true; text: string } | { ok: false }> {
	const contentLength = request.headers.get('Content-Length');
	if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) {
		return { ok: false };
	}
	if (!request.body) return { ok: true, text: '' };

	const reader = request.body.getReader();
	const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
	let total = 0;
	let text = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel('webhook body too large');
				return { ok: false };
			}
			text += decoder.decode(value, { stream: true });
		}
		text += decoder.decode();
		return { ok: true, text };
	} catch {
		return { ok: false };
	}
}
