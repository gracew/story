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

Accessing Mac localhost on iPhone

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

Dev

```
PUBLIC_URL=https://speakeasy-92b16.web.app/app yarn build
firebase deploy --only hosting
```

Prod

```
PUBLIC_URL=https://voicebar.co/app yarn build
firebase deploy --only hosting -P prod
```

## Bios

If downloading bios and reuploading (e.g. copying from dev to prod, or vice versa), you need to set the `Content-type`
header to `audio/mpeg` using the `gsutil` cli. Otherwise the default `application/octet-stream` will be used, and the
audio file won't play properly in Safari.

```
gsutil setmeta -h "Content-type: audio/mpeg" gs://speakeasy-prod.appspot.com/bios/*
```
