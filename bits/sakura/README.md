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
API_KEY=your_cartel_api_key # Optional, if authentication is required
API_URL=https://api.cartel.sh # Optional, defaults to api.cartel.sh
```

## Commands

```sh
bun run sakura
```

## Notes

- Practice data is managed through the Cartel API at `api.cartel.sh`
- Presence updates display tracked totals via the API's `getTotalTrackedHours()` endpoint
- All data operations are handled through the API SDK


