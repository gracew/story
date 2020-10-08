/*
Usage:
GOOGLE_APPLICATION_CREDENTIALS=<path to json file> yarn node scripts/validateUsers.js

Checks the following:
- each user has the fields firstName, phone
- phone starts with a +, followed by at least 1 digit 0-9
*/

const admin = require("firebase-admin");
const util = require("./util");
const moment = require('moment');

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("matches")
  .get()
  .then(res => {
    for (const doc of res.docs) {
      if (moment(doc.get("created_at").toDate()).diff(moment()) > 0) {
        console.log("populating idempotent fields for match " + doc.id);
        doc.ref.update({
          reminded: false,
          called: false,
          warned5Min: false,
          warned1Min: false,
          revealRequested: false,
        })
      }
    }
  });