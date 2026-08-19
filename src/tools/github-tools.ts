import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

const ProfileSchema = v.object({
	login: v.string(),
	name: v.nullable(v.string()),
	bio: v.nullable(v.string()),
	created_at: v.string(),
	public_repos: v.number(),
	followers: v.number(),
	following: v.number(),
});
const RepositorySchema = v.object({ fork: v.boolean(), updated_at: v.nullable(v.string()) });
const StatusSchema = v.picklist(['ok', 'not_found', 'not_configured', 'unavailable']);

export function createGitHubTools(username: string | null, token?: string) {
	return [
		defineTool({
			name: 'lookup_github_profile',
			description: 'Read public GitHub profile metadata for the account bound to this candidate.',
			output: v.object({
				status: StatusSchema,
				login: v.optional(v.string()),
				name: v.optional(v.nullable(v.string())),
				bio: v.optional(v.nullable(v.string())),
				createdAt: v.optional(v.string()),
				publicRepos: v.optional(v.number()),
				followers: v.optional(v.number()),
				following: v.optional(v.number()),
			}),
			async run({ signal }) {
				return fetchGitHubProfile(username, token, fetch, signal);
			},
		}),
		defineTool({
			name: 'inspect_github_repositories',
			description: 'Summarize public repositories for the GitHub account bound to this candidate.',
			output: v.object({
				status: StatusSchema,
				inspected: v.optional(v.number()),
				forks: v.optional(v.number()),
				originals: v.optional(v.number()),
				mostRecentUpdate: v.optional(v.nullable(v.string())),
				truncated: v.optional(v.boolean()),
			}),
			async run({ signal }) {
				return fetchGitHubRepositories(username, token, fetch, signal);
			},
		}),
	] as const;
}

export async function fetchGitHubProfile(
	username: string | null,
	token: string | undefined,
	fetcher: typeof fetch,
	signal?: AbortSignal,
) {
	if (!username) return { status: 'not_configured' as const };
	try {
		const response = await fetcher(`https://api.github.com/users/${encodeURIComponent(username)}`, {
			headers: githubHeaders(token),
			signal: combineSignals(signal),
		});
		if (response.status === 404) return { status: 'not_found' as const };
		if (!response.ok) return { status: 'unavailable' as const };
		const parsed = v.safeParse(ProfileSchema, await response.json());
		if (!parsed.success) return { status: 'unavailable' as const };
		return {
			status: 'ok' as const,
			login: parsed.output.login,
			name: parsed.output.name,
			bio: parsed.output.bio,
			createdAt: parsed.output.created_at,
			publicRepos: parsed.output.public_repos,
			followers: parsed.output.followers,
			following: parsed.output.following,
		};
	} catch {
		return { status: 'unavailable' as const };
	}
}

export async function fetchGitHubRepositories(
	username: string | null,
	token: string | undefined,
	fetcher: typeof fetch,
	signal?: AbortSignal,
) {
	if (!username) return { status: 'not_configured' as const };
	try {
		const response = await fetcher(
			`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
			{ headers: githubHeaders(token), signal: combineSignals(signal) },
		);
		if (response.status === 404) return { status: 'not_found' as const };
		if (!response.ok) return { status: 'unavailable' as const };
		const parsed = v.safeParse(v.array(RepositorySchema), await response.json());
		if (!parsed.success) return { status: 'unavailable' as const };
		const forks = parsed.output.filter((repository) => repository.fork).length;
		const updates = parsed.output.map((repository) => repository.updated_at).filter((date): date is string => date !== null);
		return {
			status: 'ok' as const,
			inspected: parsed.output.length,
			forks,
			originals: parsed.output.length - forks,
			mostRecentUpdate: updates.sort().at(-1) ?? null,
			truncated: response.headers.has('Link'),
		};
	} catch {
		return { status: 'unavailable' as const };
	}
}

function githubHeaders(token?: string): HeadersInit {
	return {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'flue-resume-investigator-example',
		'X-GitHub-Api-Version': '2022-11-28',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

function combineSignals(signal?: AbortSignal): AbortSignal {
	const timeout = AbortSignal.timeout(5_000);
	return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
