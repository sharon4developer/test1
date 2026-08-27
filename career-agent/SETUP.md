# CareerBot setup on Beelink — IT-track content refresh

This is a content refresh, not a new agent. The `careerbot` OpenClaw agent already exists and is already bound to the existing `@SharonCareerBot` Telegram bot from earlier setup work (see git history at commit `d44abff` for the original `openclaw agents add` / `agents bind` invocations). This update replaces the Saskatchewan-pivoted content that was temporarily living in this workspace with IT-track content. **No new bot and no new agent registration are needed here.**

The Saskatchewan-first retail-management/direct-support track that used to live in this folder has moved to a separate new kit, `career-agent-sask/`, for a brand-new "CareerBotSask" bot. See `career-agent-sask/SETUP.md` for that one.

## What it does now

- Finds genuine HR/company-posted IT jobs in Canada (no province restriction) that support PR or a work permit
- Auto-applies only at 75%+ profile fit (up to 10/day)
- Writes a new resume and cover letter for each job
- Reads job/recruiter email
- Drafts conversation replies
- Does not send recruiter follow-up emails until Sharon confirms

## 1. Re-sync the updated files (no agent/bot creation)

`careerbot` and its Telegram binding to `@SharonCareerBot` already exist — do not run `openclaw agents add` or create a new BotFather bot for this track. Just refresh the files on the Beelink host:

```bash
cp -a career-agent/. ~/.openclaw/workspace-career/
mkdir -p ~/.openclaw/workspace-career/memory
mkdir -p ~/.openclaw/workspace-career/cover-letters/out
mkdir -p ~/.openclaw/workspace-career/resume/out
```

If you want OpenClaw to re-read `IDENTITY.md` after the refresh:

```bash
openclaw agents set-identity --agent careerbot --from-identity --workspace ~/.openclaw/workspace-career
```

Fill `USER.md` and `resume/BASE.md` with Sharon's real IT background before enabling apply. TODO placeholders mean no applies.

## 2. Telegram bot — nothing to do

`@SharonCareerBot` is already registered and already bound to the `careerbot` agent. Do not create a new bot in BotFather for this track and do not rebind.

```bash
openclaw agents list --bindings
```

Confirm `careerbot` is still bound to its existing Telegram account; no changes needed here.

## 3. Skills

These skills were already installed for `careerbot` during earlier setup. Only touch this section if a skill is missing or needs reinstalling.

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

Copy both skills into the career workspace too (if not already present):

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

The automation likely already exists from earlier setup. If it needs to be (re)created or its message updated to reflect the IT-only, Canada-wide filters:

```bash
openclaw automations add \
  --name career-auto-apply \
  --agent careerbot \
  --every 12h \
  --session isolated \
  --announce \
  --channel telegram \
  --account careerbot \
  --message "Follow HEARTBEAT.md. Canada-wide IT only, no province restriction. HR/company-direct posts. PR (e.g. via a Provincial Nominee Program) or work-permit/LMIA/sponsorship support required. Fit 75%+. New resume per job. Max 10 today. No recruiter conversation emails."
```

## 6. First Telegram messages

```text
Read SOUL.md USER.md AGENTS.md career-guard. Confirm: Canada-wide IT only, HR/company-direct, PR-or-work-permit support, 75%+ fit, new resume per job, wait before recruiter conversation emails, separate from the Saskatchewan CareerBotSask workspace.
```

```text
Ask me the missing USER.md fields. Do not apply until the profile and base resume have real data including application email.
```

```text
Search genuine HR-posted Canadian IT jobs (no province restriction) that support PR or a work permit. Auto-apply only at 75%+ fit. Write a new resume for each. Report found, scored, applied, skipped.
```

## 7. Isolation checks

```bash
openclaw agents list --bindings
ls ~/.openclaw/workspace-career
```

Confirm `careerbot` and `careerbotsask` are two separate agents with two separate workspaces and two separate Telegram bindings.
