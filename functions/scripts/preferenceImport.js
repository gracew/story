const admin = require("firebase-admin");
const util = require("./util");
const fs = require("fs");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

const contents = fs.readFileSync("/Users/gracewang/Downloads/02-09_preferences.json").toString();
const parsed = JSON.parse(contents);
// console.log(JSON.stringify(parsed.items[0], null, 2));
parsed.items.forEach(response => {
  const userId = response.hidden.u;
  const prefs = {};
  response.answers.forEach(a => {
    let value;
    if (a.type === "text") {
      value = a.text;
    } else if (a.type === "choice") {
      value = a.choice.label || a.choice.other;
    } else if (a.type === "choices") {
      value = a.choices.labels || a.choices.other;
    }
    
    if (value === undefined) {
      return;
    }

    const split = a.field.ref.split("Dealbreakers");
    const key = split[0];
    if (!(key in prefs)) {
      prefs[key] = {};
    }
    if (split.length === 1) {
      // not a dealbreaker question
      prefs[key].value = value;
    } else {
      // dealbreaker question
      prefs[key].dealbreakers = value;
    }
  });
  return admin.firestore().collection("preferences").doc(userId).update(prefs);
});