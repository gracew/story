const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("matches")
  .get()
  .then(async res => {
    let batch = admin.firestore().batch();
    for (var i = 0; i < res.docs.length; i++) {
      const doc = res.docs[i];
      const interactions = {};
      const keys = [
        "reminded",
        "called",
        "flakesHandled",
        "warned5Min",
        "warned1Min",
        "revealRequested",
      ]
      keys.forEach(key => {
        if (doc.get(key) !== undefined) {
          interactions[key] = doc.get(key);
        }
      })
      batch.update(doc.ref, {
        called:  admin.firestore.FieldValue.delete(),
        flakesHandled:  admin.firestore.FieldValue.delete(),
        reminded:  admin.firestore.FieldValue.delete(),
        revealRequested:  admin.firestore.FieldValue.delete(),
        warned1Min:  admin.firestore.FieldValue.delete(),
        warned5Min:  admin.firestore.FieldValue.delete(),
        interactions: interactions,
      });
      if (i % 100 === 0) {
        await batch.commit();
        batch = admin.firestore().batch();
      }
    }
    return batch.commit();
  });