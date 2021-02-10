const admin = require("firebase-admin");
const moment = require('moment');
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

async function stats() {
  const weeks = await admin
    .firestore()
    .collection("scheduling")
    .get()
  var tue = 0;
  var wed = 0;
  var thu = 0;
  for (var week of weeks.docs) {
    const res = await admin
      .firestore()
      .collection("scheduling").doc(week.id).collection("users")
      .get()
    res.docs.filter(doc => doc.get("skip") !== true).forEach(doc => {
      if (doc.get("tue") === true) {
        tue++;
      }
      if (doc.get("wed") === true) {
        wed++;
      }
      if (doc.get("thu") === true) {
        thu++;
      }
    });
  }
  console.log("tue: " + tue);
  console.log("wed: " + wed);
  console.log("thu: " + thu);
}

stats();