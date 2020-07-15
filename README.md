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

Note that we are using the Ant design component library. Information on theme customization:

- https://ant.design/docs/react/use-with-create-react-app#Customize-Theme
- https://ant.design/docs/react/customize-theme

### Running the app locally

```
cd app
yarn start
```

## Deploying functions

```
cd functions
yarn deploy
# deploy to prod
yarn deploy -P prod
```

## Deploying app

```
PUBLIC_URL=https://voicebar.co yarn build
firebase deploy --only hosting
# deploy to prod
firebase deploy --only hosting -P prod
```
