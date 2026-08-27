# CareerSaskBot setup on Beelink

This agent is separate from Tony, HomeBot, SplitEasy, RuView, and the IT CareerBot (`career-agent/`, agent id `careerbot`, bound to the existing `@SharonCareerBot`). CareerSaskBot is a second, independent agent for Sharon's Saskatchewan-first retail-management and direct-support/community-services job search — it must not share a workspace, tracker, daily apply cap, resume identity, or Telegram bot with the IT CareerBot.

## What it does

- Finds genuine HR/company-posted jobs in Saskatchewan (priority: Moose Jaw, Regina), Canada fallback, that support PR (SINP) or a work permit
- Matches Sharon's real experience: retail management/supervisory and direct support/community services roles — not restricted to IT
- Auto-applies only at 75%+ profile fit (up to 10/day)
- Writes a new resume and cover letter for each job
- Reads job/recruiter email
- Drafts conversation replies
- Does not send recruiter follow-up emails until Sharon confirms

## 1. Create the OpenClaw agent

```bash
openclaw agents add careerbotsask \
  --workspace ~/.openclaw/workspace-career-sask \
  --model google/gemini-3.5-flash-lite \
  --non-interactive
```

Copy this folder into the workspace:

```bash
cp -a career-agent-sask/. ~/.openclaw/workspace-career-sask/
mkdir -p ~/.openclaw/workspace-career-sask/memory
mkdir -p ~/.openclaw/workspace-career-sask/cover-letters/out
mkdir -p ~/.openclaw/workspace-career-sask/resume/out
```

```bash
openclaw agents set-identity --agent careerbotsask --from-identity --workspace ~/.openclaw/workspace-career-sask
openclaw config set agents.entries.careerbotsask.model "google/gemini-3.5-flash-lite"
```

Fill `USER.md` and `resume/BASE.md` before enabling apply. Empty (or TODO) profile means no applies.

## 2. Dedicated Telegram bot (already created: `@SharonCareerSaskBot`)

Sharon has already created the dedicated bot for this track in BotFather: display name "CareerSaskBot", username `@SharonCareerSaskBot`. Do not reuse Tony, HomeBot, or the IT CareerBot's `@SharonCareerBot` bot — this is a separate bot account.

Get the token for `@SharonCareerSaskBot` from BotFather (`/mybots` → select it → API Token if you don't already have it saved), then attach it:

```bash
openclaw config set channels.telegram.accounts.careerbotsask.botToken "PASTE_TOKEN"
openclaw config set channels.telegram.accounts.careerbotsask.dmPolicy "allowlist"
openclaw config set channels.telegram.accounts.careerbotsask.allowFrom '["tg:8009605739"]'
openclaw agents bind --agent careerbotsask --bind telegram:careerbotsask
openclaw gateway restart
```

```bash
openclaw agents list --bindings
```

## 3. Skills

OpenClaw 2026.4.1 rejects `@owner/slug`, and bare `job-auto-apply` is ambiguous.

job-hunter:

```bash
openclaw skills install job-hunter
```

job-auto-apply: use ClawHub CLI for veeky-kumar, then install the local folder. Do not install thcjp.

```bash
cd /tmp
rm -rf clawhub-job-auto-apply
mkdir clawhub-job-auto-apply
cd clawhub-job-auto-apply
npx clawhub@latest install @veeky-kumar/job-auto-apply
openclaw skills install ./skills/job-auto-apply
```

If the folder name differs, install whatever directory contains `SKILL.md`:

```bash
find . -name SKILL.md
openclaw skills install ./skills/job-auto-apply
```

Copy both skills into the careerbotsask workspace too:

```bash
mkdir -p ~/.openclaw/workspace-career-sask/skills
cp -a /var/www/html/skills/job-hunter ~/.openclaw/workspace-career-sask/skills/ 2>/dev/null || true
cp -a ./skills/job-auto-apply ~/.openclaw/workspace-career-sask/skills/
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
openclaw automations add \
  --name career-sask-auto-apply \
  --agent careerbotsask \
  --every 12h \
  --session isolated \
  --announce \
  --channel telegram \
  --account careerbotsask \
  --message "Follow HEARTBEAT.md. Saskatchewan first (Moose Jaw, Regina), Canada fallback. HR/company-direct posts. PR (SINP) or work-permit/LMIA/sponsorship support required. Fit 75%+. New resume per job. Max 10 today. No recruiter conversation emails."
```

## 6. First Telegram messages

```text
Read SOUL.md USER.md AGENTS.md career-guard. Confirm: Saskatchewan-first (Moose Jaw, Regina), Canada fallback, HR/company-direct, PR (SINP)-or-work-permit support, 75%+ fit, new resume per job, wait before recruiter conversation emails, separate from the IT CareerBot workspace.
```

```text
Ask me the missing USER.md fields. Do not apply until the profile and base resume have real data including application email.
```

```text
Search genuine HR-posted jobs in Saskatchewan (Moose Jaw, Regina first), Canada fallback, that support PR (SINP) or a work permit. Auto-apply only at 75%+ fit. Write a new resume for each. Report found, scored, applied, skipped.
```

## 7. Isolation checks

```bash
openclaw agents list --bindings
ls ~/.openclaw/workspace-career-sask
```

Confirm `careerbotsask` and `careerbot` are two separate agents with two separate workspaces and two separate Telegram bindings.
