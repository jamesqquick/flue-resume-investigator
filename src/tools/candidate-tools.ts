import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { CandidateSchema, type Candidate } from '../candidate.ts';

const TimelineResultSchema = v.object({
	violations: v.array(
		v.object({
			type: v.picklist(['invalid_date', 'inverted_range', 'overlap']),
			roles: v.array(v.string()),
			detail: v.string(),
		}),
	),
});

const ContactResultSchema = v.object({
	resumeEmails: v.array(v.string()),
	resumePhones: v.array(v.string()),
	emailConflict: v.boolean(),
	phoneConflict: v.boolean(),
});

export function createCandidateTools(candidate: Candidate) {
	return [
		defineTool({
			name: 'load_candidate',
			description: 'Load the candidate and resume evidence bound to this investigation.',
			output: CandidateSchema,
			async run() {
				return candidate;
			},
		}),
		defineTool({
			name: 'analyze_employment_timeline',
			description: 'Deterministically find unreadable dates, inverted date ranges, and employment overlaps.',
			output: TimelineResultSchema,
			async run() {
				return analyzeEmploymentTimeline(candidate);
			},
		}),
		defineTool({
			name: 'check_resume_contacts',
			description: 'Compare resume contact values with the application and report only positive conflicts.',
			output: ContactResultSchema,
			async run() {
				return checkResumeContacts(candidate);
			},
		}),
	] as const;
}

export function analyzeEmploymentTimeline(candidate: Candidate) {
	const violations: Array<{
		type: 'invalid_date' | 'inverted_range' | 'overlap';
		roles: string[];
		detail: string;
	}> = [];
	const parsed = candidate.employments.map((employment) => {
		const label = `${employment.title} at ${employment.company}`;
		const start = parseMonth(employment.start);
		const end = employment.end === null ? Number.POSITIVE_INFINITY : parseMonth(employment.end);
		if (start === null || end === null) {
			violations.push({ type: 'invalid_date', roles: [label], detail: 'Date must use YYYY-MM.' });
			return null;
		}
		if (end < start) {
			violations.push({ type: 'inverted_range', roles: [label], detail: `${employment.end} is before ${employment.start}.` });
			return null;
		}
		return { label, start, end };
	});

	const valid = parsed.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
	for (let left = 0; left < valid.length; left += 1) {
		for (let right = left + 1; right < valid.length; right += 1) {
			const first = valid[left]!;
			const second = valid[right]!;
			if (Math.max(first.start, second.start) <= Math.min(first.end, second.end)) {
				violations.push({
					type: 'overlap',
					roles: [first.label, second.label],
					detail: 'The reported employment periods overlap.',
				});
			}
		}
	}
	return { violations };
}

export function checkResumeContacts(candidate: Candidate) {
	const resumeEmails = candidate.resumeText.match(/[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}/gi) ?? [];
	const resumePhones = candidate.resumeText.match(/(?:\+?\d[\d ().-]{8,18}\d)/g) ?? [];
	const applicationEmails = new Set(candidate.emails.map((email) => email.trim().toLowerCase()));
	const applicationPhones = new Set(candidate.phones.map(normalizePhone).filter(Boolean));
	return {
		resumeEmails,
		resumePhones,
		emailConflict:
			resumeEmails.length > 0 && !resumeEmails.some((email) => applicationEmails.has(email.toLowerCase())),
		phoneConflict:
			resumePhones.length > 0 && !resumePhones.some((phone) => applicationPhones.has(normalizePhone(phone))),
	};
}

function parseMonth(value: string): number | null {
	const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
	return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

function normalizePhone(value: string): string {
	const digits = value.replace(/\D/g, '');
	return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}
