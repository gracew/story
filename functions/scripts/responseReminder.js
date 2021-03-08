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
    const ids = res.docs.filter(doc => doc.get("interactions").responded === undefined).map(doc => admin.firestore().collection("users").doc(doc.id));
    const users = await admin.firestore().getAll(...ids);
    users.forEach(u => {
      if (u.get("timezone") === "PT") {
        console.log(`${u.get("phone")},"Your match will expire soon! If you'd like to connect this week, please fill out this super short form in the next hour to let us know your availability: https://storydating.com/weekly#u=${u.get("id")}&tz=${u.get("timezone")}"`);
      }
    })
  });
