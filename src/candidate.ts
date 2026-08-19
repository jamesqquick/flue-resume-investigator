import * as v from 'valibot';

export const EmploymentSchema = v.object({
	company: v.string(),
	title: v.string(),
	start: v.string(),
	end: v.nullable(v.string()),
});

export const CandidateSchema = v.object({
	applicationId: v.string(),
	candidateId: v.string(),
	name: v.string(),
	emails: v.array(v.string()),
	phones: v.array(v.string()),
	resumeText: v.string(),
	employments: v.array(EmploymentSchema),
	githubUsername: v.nullable(v.string()),
	source: v.picklist(['greenhouse', 'demo']),
});

export type Candidate = v.InferOutput<typeof CandidateSchema>;
