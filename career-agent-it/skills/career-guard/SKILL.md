---
name: career-guard
description: Policy for CareerBot IT auto-apply plus email gates. Use before apply, email send, or resume export.
---

# Career guard

Run this checklist before every apply.

## Must pass

- USER.md and resume/BASE.md have real experience/skills and an application email (not TODO placeholders)
- Job is IT
- Job is in Canada or for a Canadian employer / remote-in-Canada (no province restriction)
- Employer supports PR (ideally via an applicable Provincial Nominee Program) or, as fallback, a Canadian work permit, LMIA, or visa (or does not require existing authorization)
- Posting is HR/company-direct or the company's own careers page
- Named genuine employer (not confidential, not aggregator-only, not staffing blast)
- Fit score >= 75% vs USER.md must-have skills
- New resume file created for this job (not reused)
- New cover letter created for this job
- Not already applied
- Under 10 applies today

## Skip immediately

- "Must be authorized to work in Canada" / "no sponsorship" / PR or citizen only
- Non-IT, unpaid, scam, duplicate
- Unknown poster, cloned Indeed card, "multiple urgent openings"
- Fit under 75%
- Cannot write a truthful tailored resume (including when USER.md/resume/BASE.md are still TODO)

## Auto-apply allowed after the checklist

- Submit Easy Apply / company career form / application email
- Log company, link, fit%, poster, permit evidence, resume path

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
- Include work authorization: currently in Canada; seeking employer support for PR or a Canadian work permit
- Tailor bullets to that JD only, using true facts. Do not fabricate IT experience Sharon does not have.
- Save under resume/out and cover-letters/out with company and date in the filename
