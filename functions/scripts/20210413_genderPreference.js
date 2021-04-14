const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("users")
  .get()
  .then(async res => {
    let batch = admin.firestore().batch();
    for (var i = 0; i < res.docs.length; i++) {
      const doc = res.docs[i];
      const genderPreference = doc.get("genderPreference");
      if (!genderPreference || genderPreference.length === 0) {
        continue;
      }
      const update = {};
      if (genderPreference.length > 1) {
        update.genderPreference = "Everyone";
      } else if (genderPreference.length === 1) {
        if (genderPreference[0] === "Men") {
          update.genderPreference = "Men";
        } else if (genderPreference[0] === "Women") {
          update.genderPreference = "Women";
        }
      }
      batch.update(doc.ref, update);
      if (i % 400 === 0) {
        await batch.commit();
        batch = admin.firestore().batch();
      }
    }
    return batch.commit();
  });