/*
Usage:
GOOGLE_APPLICATION_CREDENTIALS=<path to json file> AFTER=2020-08-31 yarn node scripts/createMatch.js
*/

const admin = require("firebase-admin");
const moment = require("moment-timezone");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS", "AFTER"]);

admin.initializeApp();

admin
  .firestore()
  .collection("matches")
  .where("created_at", ">=", moment(process.env.AFTER))
  .get()
  .then(async (res) => {
    const allUserRefs = [];
    res.docs.forEach((doc) => {
      userRefs = doc
        .get("user_ids")
        .map((id) => admin.firestore().collection("users").doc(id));
      allUserRefs.push(...userRefs);
    });
    const allUsers = await admin.firestore().getAll(...allUserRefs);
    const allUsersById = Object.assign(
      {},
      ...allUsers.map((user) => ({ [user.id]: user }))
    );
    res.docs.forEach((doc) => {
      const time = moment(doc.get("created_at").toDate())
        .tz("America/Los_Angeles")
        .format("ddd MMM DD YYYY, h:mm z");
      const userA = allUsersById[doc.get("user_a_id")];
      const userB = allUsersById[doc.get("user_b_id")];
      const callIn = doc.get("callIn") ? ", call in" : "";
      console.log(
        `${doc.id}: ${time}, ${userA.get("firstName")} and ${userB.get(
          "firstName"
        )}${callIn}`
      );
    });
    console.log("Number of matches: " + res.docs.length);
  });
