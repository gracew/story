const admin = require("firebase-admin");
const util = require("./util");
const neatCsv = require('neat-csv');
const fs = require("fs");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

function updateKey(u, key, d, update) {
  if (!u.get(key) && d[key]) {
    console.log(`updating ${key} for user ${d.firstName} ${d.lastName}, (firestore ${u.get("firstName")} ${u.get("lastName")})`);
    /*if (d[key] === "Yes") {
      update[key] = true;
    } else if (d[key] === "No") {
      update[key] = false;
    }*/
    // update[key] = d[key];
  }
}

const contents = fs.readFileSync("/Users/gracewang/Downloads/Metadata_Import_11-15_2.csv").toString();
const rows = neatCsv(contents, { headers: ["label", "firstName", "lastName", "age", "location", "timezone", "genderPreference", "funFacts", "id", "matchMin", "matchMax", "locationFlexibility"] })
  .then(async rows => {
    var count = 0;
    for (const data of rows) {
      const user = await admin.firestore().collection("users").doc(data.id).get();
      const update = {"eligible": true};

      // updateKey(user, "locationFlexibility", data, update);

      if (Object.keys(update).length > 0) {
        count++;
        console.log(update);
        await admin
          .firestore()
          .collection("users")
          .doc(data.id)
          .update(update)
      }
    }
    console.log(count)
  });