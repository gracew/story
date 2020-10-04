/*
Usage:
GOOGLE_APPLICATION_CREDENTIALS=<path to json file> yarn node scripts/validateUsers.js

Checks the following:
- each user has the fields firstName, phone
- phone starts with a +, followed by at least 1 digit 0-9
*/

const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("matches")
  .get()
  .then(res => {
    for (const doc of res.docs) {
      if (!doc.get("user_ids")) {
        console.log("setting user_ids for match " + doc.id);
        doc.ref.update("user_ids", [doc.get("user_a_id"), doc.get("user_b_id")])
      }
    }
  });