# Kudasai

Staff utilities and lightweight AI assistant for Discord. Provides a vanish command for auto-deletion and replies to mentions using a Gemini model.

## Features

- Slash command `/vanish` with subcommands:
  - `set duration` — enable auto-deletion for the current channel (e.g., 6h, 1d, 30m, 60s)
  - `off` — disable auto-deletion
  - `status` — show current settings and counters
- Deletes old messages on an interval and updates channel topic with stats
- Responds to mentions using Gemini (model configurable in code)

## Environment

Create entries in `.env` at the repo root:

```env
KUDASAI_TOKEN=your_discord_bot_token
KUDASAI_CLIENT_ID=your_discord_application_client_id
GEMINI_API_KEY=your_google_generative_ai_key
```

Also ensure the shared database is configured:

```env
DATABASE_URL=postgres://user:pass@host:5432/db
```

## Commands

- Register and run:

```sh
bun run kudasai
```

- Dev with watch:

```sh
bun run dev:kudasai
```

## Permissions

- Bot needs permissions to read/send messages and manage messages in target channels to delete content and set channel topics.

## Notes

- Vanish statistics are stored in `vanishing_channels` (see `core/database/schema.ts`).
- The AI persona and model are defined in `bits/kudasai/agent.ts`. Adjust as needed.


