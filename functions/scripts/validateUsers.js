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
  .collection("users")
  .get()
  .then(async (res) => {
    var invalidCount = 0;
    res.docs.forEach((doc) => {
      const firstName = doc.get("firstName");
      const phone = doc.get("phone");
      if (!firstName || !(/^\+[0-9]+$/.test(phone))) {
        invalidCount++;
        console.log(doc.id);
      }
    });
    if (invalidCount > 0) {
      console.log("Number invalid users: " + invalidCount);
    } else {
      console.log("All users valid");
    }
  });
