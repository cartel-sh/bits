## cartel bits

### Overview

This monorepo hosts multiple bits that work together:

- Kudasai — Staff utilities and lightweight AI assistant for Discord (mentions + moderation helpers)
- Sakura — Practice session tracker with slash commands and stats
- Onjo — Membership applications intake and voting (with Telegram relay)

Bits use Discord bots, a shared Postgres database (via Drizzle), and optional AI models.

### Setup

1) Install Bun

```sh
curl -fsSL https://bun.sh/install | bash
```

2) Clone & install deps

```sh
git clone https://github.com/cartel-sh/bits
cd bits
bun install
```

3) Configure environment

Create a `.env` in the project root. At minimum:

```env
DATABASE_URL=postgres://user:pass@host:5432/db
# Bit-specific variables live in each bit's README
```

4) Initialize the database

```sh
bun run db:init    # or: bun run db:migrate
```

### Running

Use the per-bit READMEs for specific tokens, commands, and behavior:

- bits/kudasai/README.md — Kudasai (AI + moderation helpers)
- bits/sakura/README.md — Sakura (practice tracker)
- bits/onjo/README.md — Onjo (applications + voting)

Common scripts:

```sh
# Run a bit
bun run kudasai
bun run sakura
bun run onjo

# Dev (hot reloading where available)
bun run dev:kudasai
bun run dev:sakura
```