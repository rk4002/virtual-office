# VirtualOffice — Vercel Deployment Guide

## Quick Reference

| Resource | Value |
|----------|-------|
| **GitHub** | https://github.com/rk4002/virtual-office |
| **Region** | `arn1` (EU/Stockholm) |
| **Framework** | Next.js (App Router) |

## Prerequisites

### 1. VERCEL_TOKEN
A personal access token is required for CLI operations. **This is currently unavailable** — Rasmus must create one.

```bash
# Obtain token: https://vercel.com/account/tokens
# Set it:
echo 'VERCEL_TOKEN=your_token_here' >> ~/.hermes/.env
```

### 2. Environment Variables (once Vercel project exists)
The `vercel.json` defines 15 env vars with `@` placeholder values. Each must be set:

```bash
# Set all env vars at once:
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add AZURE_AD_CLIENT_ID production
vercel env add AZURE_AD_CLIENT_SECRET production
vercel env add AZURE_AD_TENANT_ID production
vercel env add POSTGRES_URL production
vercel env add POSTGRES_URL_NON_POOLING production
vercel env add NEXT_PUBLIC_LIVEKIT_URL production
vercel env add LIVEKIT_API_KEY production
vercel env add LIVEKIT_API_SECRET production
vercel env add NEXT_PUBLIC_PUSHER_KEY production
vercel env add PUSHER_APP_ID production
vercel env add PUSHER_SECRET production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add RESEND_API_KEY production
vercel env add NEXT_PUBLIC_APP_URL production
```

## Deployment Commands

```bash
# Link existing repo to Vercel (requires VERCEL_TOKEN)
vercel link --repo rk4002/virtual-office

# Trigger production deployment
vercel --prod

# Deploy preview from a branch
vercel
```

## Cron Jobs (active once deployed)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/backup` | Daily at 02:00 UTC | Database backup |
| `/api/cron/presence-cleanup` | Every 5 min | Clear stale presence data |

## Blocked: VERCEL_TOKEN

The deployment pipeline is fully configured (vercel.json committed, GitHub repo ready) but **cannot proceed** without `VERCEL_TOKEN`.

Rasmus must go to https://vercel.com/account/tokens, create a new token, and add it to `~/.hermes/.env`:

```bash
echo 'VERCEL_TOKEN=your_token_here' >> ~/.hermes/.env
```

Once added, run:
```bash
hermes kanban unblock t_41307762  # Unblock the Vercel project linking task
```

The remaining steps (project creation, env vars, deployment) will then be handled autonomously.