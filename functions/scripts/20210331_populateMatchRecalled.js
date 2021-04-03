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
        doc.ref.update({ "interactions.recalled": false })
      }
    }
  });