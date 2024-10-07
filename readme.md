## kuhaku bits

### Overview

- kumiko - matrix <-> discord relay (via [mautrix](https://github.com/mautrix/discord))
- kudasai - staff & role manager
- sakura - kuhaku librarian

### Installation

1. Install Bun
```sh
curl -fsSL https://bun.sh/install | bash
```

2. Clone & Install
```sh
git clone https://github.com/kuhaku-xyz/bits && cd bits && bun install
```

### Usage

You can run the different agents using the following commands:

- To run Kudasai:
  ```sh
  bun run kudasai
  ```

- To run Sakura:
  ```sh
  bun run sakura
  ```

- To run Kumiko:
  ```sh
  bun run kumiko
  ```

For development with hot reloading:

- Kudasai:
  ```sh
  bun run dev:kudasai
  ```

- Sakura:
  ```sh
  bun run dev:sakura
  ```

- Kumiko:
  ```sh
  bun run dev:kumiko
  ```

### (Deprecated) Services

To bootstrap services:
```sh
./services/action.sh
```

Or start the watchtower manually:
```sh
bun run ./services/watchtower.ts
```
This will setup the services automatically on the next push.
