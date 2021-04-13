const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("users")
  .get()
  .then(res => {
    const batch = admin.firestore().batch();
    for (const doc of res.docs) {
      const genderPreference = doc.get("genderPreference");
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
      batch.update(update);
    }
    return batch.commit();
  });