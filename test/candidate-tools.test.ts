import { describe, expect, it } from 'vitest';
import { getFixture } from '../src/fixtures/candidates.ts';
import { analyzeEmploymentTimeline, checkResumeContacts } from '../src/tools/candidate-tools.ts';

describe('candidate evidence tools', () => {
	it('keeps the clean fixture quiet', () => {
		const candidate = getFixture('clean')!;
		expect(analyzeEmploymentTimeline(candidate).violations).toEqual([]);
		expect(checkResumeContacts(candidate)).toMatchObject({ emailConflict: false, phoneConflict: false });
	});

	it('reports only positive conflicts in the suspicious fixture', () => {
		const candidate = getFixture('suspicious')!;
		expect(analyzeEmploymentTimeline(candidate).violations.map((finding) => finding.type)).toContain('inverted_range');
		expect(checkResumeContacts(candidate)).toMatchObject({ emailConflict: true, phoneConflict: true });
	});
});
