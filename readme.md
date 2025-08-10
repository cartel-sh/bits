## cartel bits

### Overview

- kumiko - matrix <-> discord relay (via [mautrix](https://github.com/mautrix/discord))
- kudasai - staff & role manager
- sakura - cartel librarian

bits use discord bots to interact with discord, matrix, and [google gemini js library](https://github.com/google-gemini/generative-ai-js) to query generative AI models.

### Installation

1. Install Bun
```sh
curl -fsSL https://bun.sh/install | bash
```

2. Clone & Install
```sh
git clone https://github.com/cartel-sh/bits && cd bits && bun install
```

### Environment Variables

Before running the bits, you need to set up the following environment variables in a `.env` file at the root of the project:

```env
# general
GEMINI_API_KEY=your_gemini_api_key_here

# sakura
SAKURA_TOKEN=your_sakura_token_here
SAKURA_CLIENT_ID=your_sakura_client_id_here

# kudasai
KUDASAI_TOKEN=your_kudasai_token_here
KUDASAI_CLIENT_ID=your_kudasai_client_id_here
```

- `SAKURA_TOKEN` and `SAKURA_CLIENT_ID`: Required for the Sakura agent to authenticate with Discord.
- `KUDASAI_TOKEN` and `KUDASAI_CLIENT_ID`: Required for the Kudasai agent to authenticate with Discord.
- `GEMINI_API_KEY`: Required for Kudasai to use the Google Generative AI model.

### Usage

You can run the different bits using the following commands:

- To run Kudasai:
  ```sh
  bun run kudasai
  ```

- To run Sakura:
  ```sh
  bun run sakura
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
