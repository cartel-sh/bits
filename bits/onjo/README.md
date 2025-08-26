# Onjo Bot

Discord bot that receives and manages membership applications with Telegram relay support.

## Features

- Receives applications via webhook from external services
- Posts formatted applications to Discord with voting buttons
- Relays applications to Telegram channel
- Interactive voting with YAY/NAY buttons
- Admin-only delete functionality
- Persistent vote tracking via API
- Auto-approval/rejection at configurable thresholds

## Setup

1. Create Discord bot and get token/client ID
2. Create Telegram bot (optional) and get token
3. Configure environment variables in repo `.env`:

```env
ONJO_TOKEN=your_discord_bot_token
ONJO_CLIENT_ID=your_discord_application_client_id
ONJO_CHANNEL_ID=your_discord_channel_id_for_applications
ONJO_PORT=3001
# Optional Telegram relay
ONJO_TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ONJO_TELEGRAM_CHANNEL_ID=your_channel_or_id
# API configuration
API_KEY=your_cartel_api_key # Optional, if authentication is required
API_URL=https://api.cartel.sh # Optional, defaults to api.cartel.sh
```

4. Start the bot: `bun run onjo`

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

Auto-decision thresholds: 7 votes

## Notes

- Application data is managed through the Cartel API at `api.cartel.sh`
- All voting and application operations are handled through the API SDK
- The webhook server runs on the configured port (default 3001)