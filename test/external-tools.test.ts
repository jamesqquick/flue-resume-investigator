import { describe, expect, it, vi } from 'vitest';
import { fetchGitHubProfile, fetchGitHubRepositories } from '../src/tools/github-tools.ts';
import { checkEmailsWithUserCheck } from '../src/tools/usercheck-tool.ts';

describe('bounded external tools', () => {
	it('normalizes GitHub profile metadata', async () => {
		const fetcher = vi.fn(async () => Response.json({
			login: 'octocat', name: 'The Octocat', bio: null, created_at: '2011-01-25T18:44:36Z',
			public_repos: 8, followers: 10, following: 2,
		})) as unknown as typeof fetch;
		expect(await fetchGitHubProfile('octocat', undefined, fetcher)).toMatchObject({ status: 'ok', login: 'octocat' });
		expect(fetcher).toHaveBeenCalledWith('https://api.github.com/users/octocat', expect.any(Object));
	});

	it('summarizes forks without accepting a model-selected account', async () => {
		const fetcher = vi.fn(async () => Response.json([
			{ fork: true, updated_at: '2026-01-01T00:00:00Z' },
			{ fork: false, updated_at: '2026-02-01T00:00:00Z' },
		])) as unknown as typeof fetch;
		expect(await fetchGitHubRepositories('bound-account', undefined, fetcher)).toMatchObject({
			status: 'ok', forks: 1, originals: 1,
		});
	});

	it('fails silent when UserCheck is not configured', async () => {
		const fetcher = vi.fn() as unknown as typeof fetch;
		expect(await checkEmailsWithUserCheck(['person@example.com'], undefined, fetcher)).toEqual({
			status: 'not_configured',
			results: [],
			truncated: false,
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('returns only selected UserCheck evidence', async () => {
		const fetcher = vi.fn(async () => Response.json({
			disposable: true, public_domain: false, relay_domain: false, role_account: false,
			spam: false, mx: true, did_you_mean: null,
		})) as unknown as typeof fetch;
		expect(await checkEmailsWithUserCheck(['person@example.com'], 'test-key', fetcher)).toMatchObject({
			status: 'ok',
			results: [{ email: 'person@example.com', status: 'ok', disposable: true }],
		});
	});
});
