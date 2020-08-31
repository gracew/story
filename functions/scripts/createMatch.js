/*
Usage:
GOOGLE_APPLICATION_CREDENTIALS=<path to json file> USER_A_ID=<> USER_B_ID=<> CREATED_AT=2020-09-03T17:00:00 yarn node scripts/createMatch.js
*/

const admin = require("firebase-admin");
const moment = require("moment");
const util = require("./util");

util.checkRequiredEnvVars([
  "GOOGLE_APPLICATION_CREDENTIALS",
  "CREATED_AT",
  "USER_A_ID",
  "USER_B_ID",
]);

admin.initializeApp();

const data = {
  created_at: moment(process.env.CREATED_AT),
  user_a_id: process.env.USER_A_ID,
  user_b_id: process.env.USER_B_ID,
  user_ids: [process.env.USER_A_ID, process.env.USER_B_ID],
};
admin.firestore().collection("matches").doc().set(data);
