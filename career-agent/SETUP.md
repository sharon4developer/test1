# CareerBot setup on Beelink

This agent is separate from Tony, HomeBot, SplitEasy, and RuView.

## What it does

- Finds genuine HR/company-posted IT jobs in Canada that support a work permit
- Auto-applies only at 75%+ profile fit (up to 10/day)
- Writes a new resume and cover letter for each job
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

Copy both skills into the career workspace too:

```bash
mkdir -p ~/.openclaw/workspace-career/skills
cp -a /var/www/html/skills/job-hunter ~/.openclaw/workspace-career/skills/ 2>/dev/null || true
cp -a ./skills/job-auto-apply ~/.openclaw/workspace-career/skills/
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
  --name career-auto-apply \
  --agent careerbot \
  --every 12h \
  --session isolated \
  --announce \
  --channel telegram \
  --account careerbot \
  --message "Follow HEARTBEAT.md. Canada IT only. HR/company-direct posts. Work-permit/LMIA/sponsorship support required. Fit 75%+. New resume per job. Max 10 today. No recruiter conversation emails."
```

## 6. First Telegram messages

```text
Read SOUL.md USER.md AGENTS.md career-guard. Confirm: Canada only, HR/company-direct, work-permit support, 75%+ fit, new resume per job, wait before recruiter conversation emails.
```

```text
Ask me the missing USER.md fields. Do not apply until the profile and base resume have real data including application email.
```

```text
Search genuine HR-posted Canadian IT jobs that support a work permit. Auto-apply only at 75%+ fit. Write a new resume for each. Report found, scored, applied, skipped.
```

## 7. Isolation checks

```bash
openclaw agents list --bindings
ls ~/.openclaw/workspace-career
```
