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
      const genderPreference = doc.get("onboardingComplete");
      if (onboardingComplete !== undefined) {
        continue;
      }
      batch.update(doc.ref, {onboardingComplete: true});
      if (i % 400 === 0) {
        await batch.commit();
        batch = admin.firestore().batch();
      }
    }
    return batch.commit();
  });

