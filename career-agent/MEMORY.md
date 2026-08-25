# MEMORY.md

## CareerBot purpose

Sharon wants an automated IT job-search agent that:

- searches genuine HR/company-posted jobs only (not generic blasts)
- stays in Canada and needs employer support for a work permit / LMIA / visa
- auto-applies only at 75%+ profile fit (cap 10/day)
- writes a new resume and cover letter for every job
- reads reply email
- recruiter conversation emails still wait for confirmation
- no home-city on resume; work-authorization line is required

## Model / platform

- OpenClaw agent id: careerbot
- Workspace: ~/.openclaw/workspace-career
- Telegram account: careerbot
- Preferred model: google/gemini-3.5-flash-lite
- Groq is backup only because free-tier rate limits hit OpenClaw prompts quickly

## Do not mix

- SplitEasy is a separate future OpenClaw project
- RuView / ESP32 WiFi sensing is separate
- HomeBot and Tony have different workspaces and rules
