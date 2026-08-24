# CareerBot setup on Beelink

This agent is separate from Tony, HomeBot, SplitEasy, and RuView.

## What it does

- Finds IT jobs
- Drafts resume and cover letters with no location line
- Auto-applies to matching IT jobs (up to 10/day)
- Reads job/recruiter email
- Drafts conversation replies
- Does not send recruiter follow-up emails until Sharon confirms

## 1. Create the OpenClaw agent

```bash
openclaw agents add career \
  --workspace ~/.openclaw/workspace-career \
  --model google/gemini-3.5-flash-lite \
  --non-interactive
```

Copy this folder into the workspace:

```bash
cp -a career-agent/. ~/.openclaw/workspace-career/
mkdir -p ~/.openclaw/workspace-career/memory
mkdir -p ~/.openclaw/workspace-career/cover-letters/out
mkdir -p ~/.openclaw/workspace-career/resume/out
```

```bash
openclaw agents set-identity --agent career --from-identity --workspace ~/.openclaw/workspace-career
openclaw config set agents.entries.career.model "google/gemini-3.5-flash-lite"
```

Fill `USER.md` and `resume/BASE.md` before enabling apply. Empty profile means no applies.

## 2. Dedicated Telegram bot

Do not reuse Tony or HomeBot.

```bash
openclaw config set channels.telegram.accounts.career.botToken "PASTE_TOKEN"
openclaw config set channels.telegram.accounts.career.dmPolicy "allowlist"
openclaw config set channels.telegram.accounts.career.allowFrom '["tg:8009605739"]'
openclaw agents bind --agent career --bind telegram:career
openclaw gateway restart
```

```bash
openclaw agents list --bindings
```

## 3. Skills

OpenClaw 2026.4.1 rejects `@owner/slug`. Use the bare slug:

```bash
openclaw skills install job-hunter
openclaw skills install job-auto-apply
```

If that still fails:

```bash
npx clawhub install job-hunter
npx clawhub install job-auto-apply
```

Optional Gmail, after you approve OAuth:

```bash
openclaw skills install gmail-email
```

If OpenClaw stores skill config in `openclaw.json`, use:

- auto_apply: true
- require_confirmation: false for job applies
- max_daily_applications: 10
- send conversation email: still false

LinkedIn/Indeed auto-apply usually needs Sharon to log those accounts in on the Beelink. That is a Gate Secrets/account step. Do not paste cookies into chat.

## 4. Email policy

Auto:

- send application emails that are the job apply itself

Still confirm:

- recruiter thread replies
- follow-ups
- forwards

## 5. Daily automation

```bash
openclaw cron add \
  --name career-auto-apply \
  --agent career \
  --every 12h \
  --message "Follow HEARTBEAT.md. Auto-apply matching IT jobs up to 10 today. Do not send recruiter conversation emails."
```

## 6. First Telegram messages

```text
Read SOUL.md USER.md AGENTS.md. Confirm you auto-apply matching IT jobs, omit location on resumes, and still wait before sending recruiter conversation emails.
```

```text
Ask me the missing USER.md fields. Do not apply until the profile and base resume have real data.
```

```text
Search IT jobs and auto-apply to the ones that fit. Report what you applied to.
```

## 7. Isolation checks

```bash
openclaw agents list --bindings
ls ~/.openclaw/workspace-career
```
