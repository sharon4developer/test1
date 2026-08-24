# CareerBot setup on Beelink

This agent is separate from Tony, HomeBot, SplitEasy, and RuView.

## What it does

- Finds IT jobs
- Drafts resume and cover letters with no location line
- Reads job/recruiter email
- Creates email drafts
- Never sends email or applies until Sharon confirms that exact item

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

If this repo is not on the Beelink, copy the `career-agent` directory over first.

```bash
openclaw agents set-identity --agent career --from-identity --workspace ~/.openclaw/workspace-career
openclaw config set agents.entries.career.model "google/gemini-3.5-flash-lite"
```

If your OpenClaw version uses `agents.list` instead of `agents.entries`, set the model on that career row.

Fill `~/.openclaw/workspace-career/USER.md` and `resume/BASE.md` before the first search.

## 2. Dedicated Telegram bot

Do not reuse Tony or HomeBot.

1. In Telegram, open BotFather
2. Create a bot, for example CareerSharonBot
3. Copy the token into OpenClaw, not into chat

```bash
openclaw config set channels.telegram.accounts.career.botToken "PASTE_TOKEN"
openclaw config set channels.telegram.accounts.career.dmPolicy "allowlist"
openclaw config set channels.telegram.accounts.career.allowFrom '["tg:8009605739"]'
openclaw agents bind --agent career --bind telegram:career
openclaw gateway restart
```

Confirm:

```bash
openclaw agents list --bindings
```

You want career bound only to `telegram:career`.

## 3. Skills

Install search help, not auto-send:

```bash
openclaw skills install @sharbelayy/job-hunter
```

Optional Gmail read/draft, after you approve OAuth:

```bash
openclaw skills install @hith3sh/gmail-email
```

Do not install auto-apply/auto-send skills.

Copy the guard skill into the career workspace if it is not already there:

```bash
mkdir -p ~/.openclaw/workspace-career/skills/career-guard
cp skills/career-guard/SKILL.md ~/.openclaw/workspace-career/skills/career-guard/SKILL.md
```

## 4. Email policy

Allowed:

- read inbox
- create drafts

Blocked until Sharon says send it / approved / apply to this job:

- send email
- send draft
- reply-send
- Easy Apply submit

## 5. Daily automation

Heartbeat already describes the loop. Optional cron, twice a day:

```bash
openclaw cron add \
  --name career-digest \
  --agent career \
  --every 12h \
  --message "Follow HEARTBEAT.md. Do not send email. Do not apply."
```

## 6. First messages in Telegram

Send to CareerBot:

```text
Read SOUL.md USER.md AGENTS.md. Confirm you will not send email or apply without my confirmation. Confirm resumes will omit location.
```

Then:

```text
Fill nothing. Ask me the missing USER.md fields one batch at a time.
```

Then:

```text
Find 10 IT jobs matching my target titles. Do not apply. Give fit notes and draft a resume plus cover letter for the top 1 only.
```

## 7. Isolation checks

```bash
openclaw agents list --bindings
ls ~/.openclaw/workspace-career
```

CareerBot must use `workspace-career`, not Tony or HomeBot workspaces.
