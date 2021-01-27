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
  .get()
  .then(async (res) => {
    var invalidCount = 0;
    const allUserRefs = [];
    const allKeys = new Set();
    const types = {};
    const firstAppearances = {};
    const lastAppearances = {};
    const docs = Array.from(res.docs);
    docs.sort((a, b) => {
      if (a.createTime < b.createTime) {
        return -1;
      } else if (a.createTime > b.createTime) {
        return 1;
      }
      return 0;
    });
    docs.forEach((doc, index) => {
      const docData = doc.data();
      Object.keys(docData).forEach(key => {
        if (!allKeys.has(key)) {
          firstAppearances[key] = {
            datetime: doc.createTime.toDate(),
            index,
          };
        }
        allKeys.add(key);
        lastAppearances[key] = {
          datetime: doc.createTime.toDate(),
          index,
        };
      });
      Object.entries(docData).forEach(([key, value]) => {
        if (!(key in types)) {
          types[key] = {};
        }
        const frequencies = types[key];
        if (!(typeof value in frequencies)) {
          frequencies[typeof value] = 0;
        }
        frequencies[typeof value] += 1;
      });

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
    }

    const stats = {};
    allKeys.forEach((key) => {
      stats[key] = {
        type: Object.keys(types[key])[0],
        nulls: docs.length - Object.values(types[key])[0],
        percentNull: (docs.length - Object.values(types[key])[0]) / docs.length,
        percentNullAfterIntro: (docs.length - Object.values(types[key])[0] - firstAppearances[key].index) / (docs.length - firstAppearances[key].index),
        percentNullAfterIntroBeforeOutro: (lastAppearances[key].index - Object.values(types[key])[0] - firstAppearances[key].index + 1) / (lastAppearances[key].index - firstAppearances[key].index + 1),
        firstAppeared: firstAppearances[key].datetime,
        lastAppeared: lastAppearances[key].datetime,
      };
    })
    console.log(`All keys: ${Array.from(allKeys)}`);
    console.log(`types: ${JSON.stringify(types, null, 2)}`);
    console.log(`firstAppearances: ${JSON.stringify(firstAppearances, null, 2)}`);
    console.log(`stats: ${JSON.stringify(stats, null, 2)}`);
  });
