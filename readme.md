## Kuhaku Agents

### Overview

- Kumiko - watches over kuhaku service health
- Kudasai - staff & role manager
- Sakura - keeps kuhaku up to date

### Installation

0. Install `nvm` & `npm`
```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

nvm install 21
nvm use 21
```

1. Clone & Install
```sh
git clone https://github.com/kuhaku-xyz/bits && cd bits && npm install
```

2. Bootstrap services with
```sh 
./services/action.sh
```
or start the watchtower manually:
```sh
npx ts-node ./services/watchtower.ts
```
and it'll setup the services automagically on next push
