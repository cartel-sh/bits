# Sakura

Practice session tracker for Discord with slash commands and stats.

## Features

- `/start [notes]` — start a practice session
- `/stop` — stop your current session; bot updates presence with total hours
- `/stats` subcommands:
  - `daily` — today's total
  - `weekly` — last 7 days summary
  - `monthly` — month total + daily breakdown
  - `top` — leaderboard of total durations
- Optional server channel configuration (`setchannel`, `checkchannels`) for notifications

## Environment

Add to `.env` in the repo root:

```env
SAKURA_TOKEN=your_discord_bot_token
SAKURA_CLIENT_ID=your_discord_application_client_id
DATABASE_URL=postgres://user:pass@host:5432/db
```

## Commands

```sh
bun run sakura
```

## Notes

- Practice data is stored in `users`, `user_identities`, and `practice_sessions` tables (see `core/database/schema.ts`).
- Presence updates display tracked totals via `getTotalTrackedHours()`.


