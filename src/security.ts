const encoder = new TextEncoder();

export async function secureEqual(left: string, right: string): Promise<boolean> {
	const [leftHash, rightHash] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(left)),
		crypto.subtle.digest('SHA-256', encoder.encode(right)),
	]);
	const leftBytes = new Uint8Array(leftHash);
	const rightBytes = new Uint8Array(rightHash);
	let difference = 0;
	for (let index = 0; index < leftBytes.length; index += 1) {
		difference |= leftBytes[index]! ^ rightBytes[index]!;
	}
	return difference === 0;
}

export function bearerToken(header: string | undefined): string | undefined {
	return /^Bearer ([^\s]+)$/i.exec(header ?? '')?.[1];
}

export async function verifyGreenhouseSignature(
	rawBody: string,
	signatureHeader: string | undefined,
	secret: string | undefined,
): Promise<boolean> {
	if (!signatureHeader || !secret) return false;
	const match = /^sha256 ([0-9a-f]{64})$/i.exec(signatureHeader.trim());
	if (!match) return false;

	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
	const computed = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
	return secureEqual(computed, match[1]);
}
