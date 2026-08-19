import type { Candidate } from '../candidate.ts';

const fixtures: Record<string, Candidate> = {
	clean: {
		applicationId: '1001',
		candidateId: '2001',
		name: 'Casey Example',
		emails: ['octocat@github.com'],
		phones: ['+1 415 555 0100'],
		resumeText:
			'Casey Example\nEmail: octocat@github.com\nPhone: +1 415 555 0100\nExample Labs, Engineer, 2021-01 to 2023-06\nSample Systems, Senior Engineer, 2023-07 to present',
		employments: [
			{ company: 'Example Labs', title: 'Engineer', start: '2021-01', end: '2023-06' },
			{ company: 'Sample Systems', title: 'Senior Engineer', start: '2023-07', end: null },
		],
		githubUsername: 'octocat',
		source: 'demo',
	},
	suspicious: {
		applicationId: '1002',
		candidateId: '2002',
		name: 'Jordan Fixture',
		emails: ['jordan@temporary-mail.example'],
		phones: ['+1 212 555 0199'],
		resumeText:
			'Jordan Fixture\nEmail: another@example.net\nPhone: +1 646 555 0110\nNorthwind, Analyst, 2024-08 to 2023-01\nContoso, Engineer, 2023-01 to 2024-12',
		employments: [
			{ company: 'Northwind', title: 'Analyst', start: '2024-08', end: '2023-01' },
			{ company: 'Contoso', title: 'Engineer', start: '2023-01', end: '2024-12' },
		],
		githubUsername: 'flue-synthetic-candidate-does-not-exist',
		source: 'demo',
	},
};

export function getFixture(id: string): Candidate | undefined {
	return fixtures[id];
}
