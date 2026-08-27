# MEMORY.md

## CareerBot IT purpose

Sharon wants a second, independent automated job-search agent, separate from CareerBot (Saskatchewan retail/direct-support track, `career-agent/`), that:

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

- OpenClaw agent id: careerit
- Workspace: ~/.openclaw/workspace-career-it
- Telegram account: careerit (new dedicated BotFather bot — do not reuse CareerBot's `@SharonCareerBot` or its `careerbot` Telegram account)
- Preferred model: google/gemini-3.5-flash-lite
- Groq is backup only because free-tier rate limits hit OpenClaw prompts quickly

## Do not mix

- `career-agent` / CareerBot (agent id `careerbot`, workspace `~/.openclaw/workspace-career`) is the separate Saskatchewan-first retail-management and direct-support/community-services job search track. Different Telegram bot, tracker, daily apply cap, and resume identity — do not merge state or assumptions between the two.
- SplitEasy is a separate future OpenClaw project
- RuView / ESP32 WiFi sensing is separate
- HomeBot and Tony have different workspaces and rules
