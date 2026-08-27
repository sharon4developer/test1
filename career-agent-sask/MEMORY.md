# MEMORY.md

## CareerBotSask purpose

Sharon wants an automated job-search agent that:

- searches genuine HR/company-posted jobs only (not generic blasts)
- targets Saskatchewan first (priority: Moose Jaw, Regina), rest of Canada as fallback
- matches real experience: retail management (7-Eleven Assistant Store Manager) and direct support/community services (Direct Support Professional) — not restricted to IT
- stays in Canada and needs employer support for PR (SINP) or, as a fallback, a work permit/LMIA/visa
- auto-applies only at 75%+ profile fit (cap 10/day)
- writes a new resume and cover letter for every job
- reads reply email
- recruiter conversation emails still wait for confirmation
- no home-city on resume; work-authorization line is required

## Model / platform

- OpenClaw agent id: careerbotsask
- Workspace: ~/.openclaw/workspace-career-sask
- Telegram account: careerbotsask (new dedicated BotFather bot named "CareerBotSask" — do not reuse the IT CareerBot's `@SharonCareerBot` or its `careerbot` Telegram account)
- Preferred model: google/gemini-3.5-flash-lite
- Groq is backup only because free-tier rate limits hit OpenClaw prompts quickly

## Do not mix

- `career-agent` / CareerBot (agent id `careerbot`, workspace `~/.openclaw/workspace-career`, bound to the existing `@SharonCareerBot`) is the separate Canada-wide IT job search track. Different Telegram bot, tracker, daily apply cap, and resume identity — do not merge state or assumptions between the two.
- SplitEasy is a separate future OpenClaw project
- RuView / ESP32 WiFi sensing is separate
- HomeBot and Tony have different workspaces and rules
