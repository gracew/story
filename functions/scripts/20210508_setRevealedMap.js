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
      const revealed = doc.get("revealed");
      if (revealed !== undefined) {
        continue;
      }
      const userARevealed = doc.get("user_a_revealed");
      const userBRevealed = doc.get("user_b_revealed");
      const map = {};
      if (userARevealed !== undefined) {
        map[doc.get("user_a_id")] = userARevealed;
      }
      if (userBRevealed !== undefined) {
        map[doc.get("user_b_id")] = userBRevealed;
      }
      batch.update(doc.ref, {
        "user_a_revealed": admin.firestore.FieldValue.delete(),
        "user_b_revealed": admin.firestore.FieldValue.delete(),
        "revealed": map,
      });
      if (i % 400 === 0) {
        await batch.commit();
        batch = admin.firestore().batch();
      }
    }
    return batch.commit();
  });

