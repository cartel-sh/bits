# Onjo Bot

Discord bot that receives and manages membership applications with Telegram relay support.

## Features

- Receives applications via webhook from external services
- Posts formatted applications to Discord with voting buttons
- Relays applications to Telegram channel
- Interactive voting with YAY/NAY buttons
- Admin-only delete functionality
- Persistent vote tracking in database
- Auto-approval/rejection at configurable thresholds

## Setup

1. Create Discord bot and get token/client ID
2. Create Telegram bot (optional) and get token
3. Configure environment variables in repo `.env`:

```env
ONJO_TOKEN=your_discord_bot_token
ONJO_CLIENT_ID=your_discord_application_client_id
# Optional Telegram relay
ONJO_TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ONJO_TELEGRAM_CHANNEL_ID=your_channel_or_id
DATABASE_URL=postgres://user:pass@host:5432/db
ONJO_CHANNEL_ID=your_discord_channel_id_for_applications
ONJO_PORT=3001
```

4. Run database migrations (in repo root)
5. Start the bot: `bun run onjo`

## API Endpoint

`POST /api/application` - Submit new application

Expected payload:
```json
{
  "walletAddress": "0x...",
  "ensName": "user.eth",
  "github": "https://github.com/username",
  "farcaster": "https://farcaster.xyz/username",
  "lens": "https://hey.xyz/u/username",
  "twitter": "https://twitter.com/username",
  "excitement": "What excites you answer",
  "motivation": "Why good fit answer",
  "signature": "0x...",
  "message": "Signed message content"
}
```

## Voting System

- **YAY**: Vote to approve
- **NAY**: Vote to reject
- **Delete**: Remove application (admin only)

Auto-decision thresholds: 3 votes