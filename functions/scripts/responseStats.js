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
    const ids = res.docs.filter(doc => Object.keys(doc.data()).length > 0 && doc.get("skip") !== true).map(doc => admin.firestore().collection("users").doc(doc.id));
    const users = await admin.firestore().getAll(...ids);
    var menPt = [];
    var menEt = [];
    var womenPt = [];
    var womenEt = [];
    users.forEach(u => {
      const name = u.get("firstName") + " " + u.get("lastName");
      if (u.get('timezone') === "ET") {
        if (u.get("gender") === "Male") {
          menEt.push(name);
        } else if (u.get("gender") === "Female") {
          womenEt.push(name);
        }
      } else if (u.get("timezone") === "PT") {
        if (u.get("gender") === "Male") {
          menPt.push(name);
        } else if (u.get("gender") === "Female") {
          womenPt.push(name);
        }
      }
    })
    console.log("menPt: " + menPt.length);
    console.log(menPt);
    console.log("womenPt: " + womenPt.length);
    console.log(womenPt);
    console.log("menEt: " + menEt.length);
    console.log(menEt);
    console.log("womenEt: " + womenEt.length);
    console.log(womenEt);
  });
