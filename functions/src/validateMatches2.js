/*
Usage:
GOOGLE_APPLICATION_CREDENTIALS=<path to json file> yarn node scripts/validateMatches.js

Checks the following:
- each match has the fields id, user_ids, user_a_id, user_b_id, reminded, called, warned5Min, warned1Min, revealRequested
- user_ids is of size 2 and contains both user_a_id and user_b_id
- the user_ids map to documents in the users collection
*/

const admin = require("firebase-admin");

export async function analyzeCollection(collectionName) {
  const stats = {};

  const res = await admin
    .firestore()
    .collection(collectionName)
    .get();

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
    Object.keys(docData).forEach((key) => {
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
  });

  allKeys.forEach((key) => {
    stats[key] = {
      type: Object.keys(types[key])[0],
      nulls: docs.length - Object.values(types[key])[0],
      percentNull:
        (docs.length - Object.values(types[key])[0]) / docs.length,
      percentNullAfterIntro:
        (docs.length -
          Object.values(types[key])[0] -
          firstAppearances[key].index) /
        (docs.length - firstAppearances[key].index),
      percentNullAfterIntroBeforeOutro:
        (lastAppearances[key].index -
          Object.values(types[key])[0] -
          firstAppearances[key].index +
          1) /
        (lastAppearances[key].index - firstAppearances[key].index + 1),
      firstAppeared: firstAppearances[key].datetime,
      lastAppeared: lastAppearances[key].datetime,
    };
  });
  console.log(`All keys: ${Array.from(allKeys)}`);
  console.log(`types: ${JSON.stringify(types, null, 2)}`);
  console.log(
    `firstAppearances: ${JSON.stringify(firstAppearances, null, 2)}`
  );
  console.log(`stats: ${JSON.stringify(stats, null, 2)}`);

  return stats;
}
