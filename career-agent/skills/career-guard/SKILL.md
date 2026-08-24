---
name: career-guard
description: Hard gates for CareerBot. Use before any email send, job apply, or resume export. Blocks outbound actions unless Sharon confirmed the exact item.
---

# Career guard

Apply these checks before any outbound action.

## Allowed without confirmation

- Job search
- Fit scoring
- Resume draft files
- Cover letter draft files
- Reading email
- Creating email drafts
- Tracker updates

## Blocked without exact confirmation

- gmail_send_email
- gmail_send_draft
- gmail_reply_to_thread
- gmail_forward_message
- SMTP send
- LinkedIn Easy Apply submit
- Indeed/Glassdoor one-click apply
- Any HTTP form post that submits an application
- Auto-apply scripts

Confirmation must name the thing, for example:

- send the Amazon draft
- apply to the Acme backend role

A general "go ahead" or "automate applications" is not enough.

## Resume export

Before writing a resume or cover letter:

- No current city/state/country in header
- No "Location:" line
- Relocate-ready may appear only if Sharon asked for that sentence

## If a job skill wants to auto-send

Stop. Convert the action into:

1. drafted files
2. a Telegram summary
3. wait for confirmation
