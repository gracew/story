# Story

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

### Running the frontend app locally

This will run the app against local Firebase emulators (see instructions below).

```bash
cd app
yarn start # or `yarn staging-dev` to run against the Firestore in staging
```

#### Running the backend (Firestore emulator) locally

```bash
cd functions
yarn serve
```

There's also a way to grab runtime configuration options from staging, though it's not strictly required to run the
backend, this is just required for external services.

```bash
firebase functions:config:get > functions/.runtimeconfig.json
```

#### Accessing Mac localhost on iPhone

1. Connect iPhone to Mac via USB, make sure it's on the same Wifi network
2. Find Mac IP Address (System Preferences, Wifi)
3. Type in Mac IP Address on iPhone

Note that Safari iOS voice recording only works over https so you will need to deploy to dev (see below) in order to test that functionality.

## Deploying functions

```
cd functions
yarn deploy
# deploy to prod
yarn deploy -P prod
```

## Deploying app

### Staging (manual)
Commits to master automatically deploy via Netlify. App will be at https://story-staging.netlify.app/signup

To push to staging manually:
```
PUBLIC_URL=https://speakeasy-92b16.web.app/ yarn build
firebase deploy --only hosting
```

### Prod
GitHub releases automatically deploy via Netlify.

## Bios

If downloading bios and reuploading (e.g. copying from dev to prod, or vice versa), you need to set the `Content-type`
header to `audio/mpeg` using the `gsutil` cli. Otherwise the default `application/octet-stream` will be used, and the
audio file won't play properly in Safari.

```
gsutil setmeta -h "Content-type: audio/mpeg" gs://speakeasy-prod.appspot.com/bios/*
```

### Test phone numbers
Sometimes you need to test making new user accounts. In either staging or production, or in development with Twilio 
- Add a "phone number for testing" from this page:
  https://console.firebase.google.com/u/0/project/speakeasy-92b16/authentication/providers
- Use a number from https://fakenumber.org/ so we don't accidentally text a real number.

