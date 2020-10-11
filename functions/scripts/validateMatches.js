/*
Usage:
GOOGLE_APPLICATION_CREDENTIALS=<path to json file> yarn node scripts/validateMatches.js

Checks the following:
- each match has the fields id, user_ids, user_a_id, user_b_id, reminded, called, warned5Min, warned1Min, revealRequested
- user_ids is of size 2 and contains both user_a_id and user_b_id
- the user_ids map to documents in the users collection
*/

const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("matches")
  .where("created_at", ">=", new Date("2020-10-08T07:00:00.000Z"))
  .get()
  .then(async (res) => {
    var invalidCount = 0;
    const allUserRefs = [];

    res.docs.forEach((doc) => {
      if (!doc.get("id") ||
        doc.get("reminded") === undefined ||
        doc.get("called") === undefined ||
        doc.get("warned5Min") === undefined ||
        doc.get("warned1Min") === undefined ||
        doc.get("revealRequested") === undefined) {
        invalidCount++;
        console.log(doc.id);
        return;
      }

      const userIds = doc.get("user_ids");
      const userAId = doc.get("user_a_id");
      const userBId = doc.get("user_b_id");
      userRefs = userIds.map((id) => admin.firestore().collection("users").doc(id));
      allUserRefs.push(...userRefs);

      if (
        userIds.length != 2 ||
        !userIds.includes(userAId) ||
        !userIds.includes(userBId)
      ) {
        invalidCount++;
        console.log(doc.id);
      }
    });

    if (invalidCount > 0) {
      console.log("Number invalid matches: " + invalidCount);
    } else {
      console.log("All matches valid, now verifying user ids exist");

      const allUsers = await admin.firestore().getAll(...allUserRefs);
      const badRefs = allUsers.filter(d => !d.exists);
      if (badRefs.length > 0) {
        console.log("Bad user ids: " + badRefs);
      } else {
        console.log("All user ids valid");
      }
    }
  });
