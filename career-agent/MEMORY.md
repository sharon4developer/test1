# MEMORY.md

## CareerBot purpose

Sharon wants an automated IT job-search agent, separate from CareerBotSask (Saskatchewan retail/direct-support track, `career-agent-sask/`), that:

- searches genuine HR/company-posted IT jobs only (not generic blasts)
- targets Canada-wide, no province/city restriction
- stays in Canada and needs employer support for PR (e.g. via a Provincial Nominee Program) or, as a fallback, a work permit/LMIA/visa
- auto-applies only at 75%+ profile fit (cap 10/day)
- writes a new resume and cover letter for every job
- reads reply email
- recruiter conversation emails still wait for confirmation
- no home-city on resume; work-authorization line is required
- does not fabricate IT work history — Sharon's confirmed background is retail management (7-Eleven) and direct support work, not IT; USER.md/resume/BASE.md stay TODO until she provides real IT skills/experience

## Model / platform

- OpenClaw agent id: careerbot
- Workspace: ~/.openclaw/workspace-career
- Telegram account: careerbot (existing account, bound to `@SharonCareerBot` — no new bot needed)
- Preferred model: google/gemini-3.5-flash-lite
- Groq is backup only because free-tier rate limits hit OpenClaw prompts quickly

## Do not mix

- `career-agent-sask` / CareerBotSask (agent id `careerbotsask`, workspace `~/.openclaw/workspace-career-sask`) is the separate Saskatchewan-first retail-management and direct-support/community-services job search track. Different Telegram bot, tracker, daily apply cap, and resume identity — do not merge state or assumptions between the two.
- SplitEasy is a separate future OpenClaw project
- RuView / ESP32 WiFi sensing is separate
- HomeBot and Tony have different workspaces and rules
