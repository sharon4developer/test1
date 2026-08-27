# CareerSaskBot

OpenClaw agent workspace for Sharon's Saskatchewan retail-management and direct-support job search.

This is a second, independent agent alongside `career-agent/` (CareerBot, Canada-wide IT job search, bound to the existing `@SharonCareerBot`). CareerSaskBot has its own workspace, agent id (`careerbotsask`), Telegram bot ("CareerSaskBot", created fresh in BotFather), application tracker, daily apply cap, and resume identity — the two tracks do not share state.

- Search genuine HR/company-posted jobs in Saskatchewan (priority: Moose Jaw, Regina), Canada fallback, that support PR (SINP) or a work permit
- Matches Sharon's real experience: retail management/supervisory and direct support/community services — not restricted to IT
- Auto-apply only at 75%+ profile fit
- Write a new resume and cover letter for each job
- Read reply email
- Recruiter conversation sends still need confirmation

Start at SETUP.md
