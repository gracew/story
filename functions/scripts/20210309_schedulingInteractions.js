const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("scheduling")
  .doc("2021-03-07")
  .collection("users")
  .get()
  .then(async res => {
    const batch = admin.firestore().batch();
    for (const doc of res.docs) {
      batch.update(doc.ref, "interactions.acknowledged", admin.firestore.FieldValue.delete());
    }
    return batch.commit();
  });