/*
Usage:
GOOGLE_APPLICATION_CREDENTIALS=<path to json file> yarn node scripts/validateUsers.js

Checks the following:
- each user has the fields firstName, phone
- phone starts with a +, followed by at least 1 digit 0-9
*/

const admin = require("firebase-admin");
const util = require("./util");
const neatCsv = require('neat-csv');
const fs = require("fs");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

const contents = fs.readFileSync("/Users/gracewang/Downloads/Users-Primary-final.csv").toString();
const rows = neatCsv(contents, { headers: ["userId", "funFacts"] })
  .then(rows => rows.map(data => {
    admin
      .firestore()
      .collection("users")
      .doc(data.userId)
      .update("funFacts", data.funFacts)
  }))