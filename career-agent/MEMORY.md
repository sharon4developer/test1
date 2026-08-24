# MEMORY.md

## CareerBot purpose

Sharon wants an automated IT job-search agent that:

- finds jobs
- writes resume and cover letters
- reads reply email
- auto-applies to matching IT jobs (cap 10/day)
- recruiter conversation emails still wait for confirmation
- omits location on resume because Sharon is willing to relocate

## Model / platform

- OpenClaw agent id: career
- Workspace: ~/.openclaw/workspace-career
- Preferred model: google/gemini-3.5-flash-lite
- Groq is backup only because free-tier rate limits hit OpenClaw prompts quickly

## Do not mix

- SplitEasy is a separate future OpenClaw project
- RuView / ESP32 WiFi sensing is separate
- HomeBot and Tony have different workspaces and rules
