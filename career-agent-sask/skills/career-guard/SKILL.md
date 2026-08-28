---
name: career-guard
description: Policy for CareerSaskBot auto-apply plus email gates. Use before apply, email send, or resume export.
---

# Career guard

Run this checklist before every apply.

## Must pass

- USER.md and resume/BASE.md have real experience/skills and an application email
- Job is not IT/software/tech (that's the separate CareerBot agent's job)
- Job is full-time (not part-time/casual/contract/gig)
- Job is in Saskatchewan (priority: Moose Jaw, Regina) or, as fallback, in Canada / for a Canadian employer / remote-in-Canada
- Employer supports PR (permanent residency) — hard requirement. Ideally SINP, but any employer-backed PR pathway counts. A work-permit/LMIA-only posting with no PR pathway does NOT pass this check.
- Posting is HR/company-direct or the company's own careers page
- Named genuine employer (not confidential, not aggregator-only, not staffing blast)
- Employer has acceptable/good public reviews (Glassdoor/Indeed/Google or similar), or reviews were not found and this is flagged to Sharon
- Fit score >= 75% vs USER.md must-have skills, using a truthful resume (any role is fine, but the resume cannot fabricate experience)
- New resume file created for this job (not reused)
- New cover letter created for this job
- Not already applied
- Under 10 applies today

## Skip immediately

- IT/software/tech roles — route mentally to "CareerBot handles this", not this agent
- "Must be authorized to work in Canada" / "no sponsorship" / PR or citizen only
- Work permit/LMIA offered but no PR pathway mentioned anywhere in the posting
- Part-time, casual, contract, gig, or seasonal
- Unpaid, scam, duplicate
- Unknown poster, cloned Indeed card, "multiple urgent openings"
- Employer has clearly bad/negative public reviews (unpaid wages, unsafe conditions, scam reports)
- Fit under 75%
- Cannot write a truthful tailored resume

## Auto-apply allowed after the checklist

- Submit Easy Apply / company career form / application email
- Log company, link, fit%, poster, PR evidence, review status, resume path

## Still blocked without exact confirmation

- Recruiter conversation replies
- Follow-up emails that are not the original application
- Forwarding mail
- Changing LinkedIn/Indeed public profile
- .env / OAuth / cookie changes

Confirmation examples for conversation mail:

- send the Amazon reply
- approved

## Resume export

- No home-city header
- Include work authorization: currently in Canada; seeking employer support for PR (SINP) or a Canadian work permit
- Tailor bullets to that JD only, using true facts
- Save under resume/out and cover-letters/out with company and date in the filename
