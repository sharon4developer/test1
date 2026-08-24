---
name: career-guard
description: Policy for CareerBot auto-apply plus email gates. Use before apply, email send, or resume export.
---

# Career guard

## Auto-apply allowed

When USER.md and resume/BASE.md are filled, CareerBot may:

- Search jobs
- Score fit
- Tailor resume and cover letter
- Submit Easy Apply / job-board applications
- Send application emails (resume + cover letter to the posting apply address)
- Log applications

Limits:

- IT roles only
- Fit medium or high
- Max 10 applies per calendar day
- Skip unpaid, scam, and dealbreakers
- Skip duplicates already marked applied

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

Before writing a resume or cover letter:

- No current city/state/country in header
- No "Location:" line
- Relocate-ready may appear only if Sharon asked for that sentence

## If profile is empty

Do not auto-apply. Ask Sharon to fill USER.md and resume/BASE.md.
