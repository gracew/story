const admin = require("firebase-admin");
const moment = require('moment');
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

const week = moment().startOf("week").format("YYYY-MM-DD");
admin
  .firestore()
  .collection("scheduling").doc(week).collection("users")
  .get()
  .then(async (res) => {
    const ids = res.docs.filter(doc => Object.keys(doc.data()).length === 2).map(doc => admin.firestore().collection("users").doc(doc.id));
    const users = await admin.firestore().getAll(...ids);
    users.forEach(u => {
      if (u.get("timezone") === "PT") {
        console.log(u.get("firstName") + " " + u.get("lastName"));
        console.log(`${u.get("phone")},"Your match will expire soon! If you'd like to connect this week, please reply in the next hour and let us know which days work for you for an 8PM ${u.get("timezone")} call."`);
      }
    })
  });
