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
      if (!doc.get("canceled")) {
        console.log("setting canceled for match " + doc.id);
        doc.ref.update("canceled", false);
      }
    }
  });