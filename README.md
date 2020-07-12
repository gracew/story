# speakeasy

## Dev setup

### Prerequisites

- Node 10 (recommend using NVM) + Yarn
- Install firebase cli globally: `npm install -g firebase-tools`

### Install dependencies

```
cd functions
yarn
```

```
cd app
yarn
```

### Running the app locally

```
cd app
yarn start
```

## Deploying functions

```
cd functions
yarn deploy
```

## Deploying app

```
PUBLIC_URL=https://voicebar.co yarn build
firebase deploy --only hosting
```
