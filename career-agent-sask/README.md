# CareerSaskBot

OpenClaw agent workspace for Sharon's Saskatchewan job search.

This is a second, independent agent alongside `career-agent/` (CareerBot, Canada-wide IT job search, bound to the existing `@SharonCareerBot`). CareerSaskBot has its own workspace, agent id (`careerbotsask`), Telegram bot ("CareerSaskBot", `@SharonCareerSaskBot`), application tracker, daily apply cap, and resume identity — the two tracks do not share state.

- Search genuine, full-time, HR/company-posted jobs in Saskatchewan (priority: Moose Jaw, Regina), Canada fallback — any role, not restricted to a fixed title list
- Employer must support PR (permanent residency) — a hard requirement, ideally via SINP
- Check employer public reviews before applying; skip employers with bad reviews
- Auto-apply only at 75%+ truthful resume fit
- Write a new resume and cover letter for each job
- Read reply email
- Recruiter conversation sends still need confirmation

Start at SETUP.md
