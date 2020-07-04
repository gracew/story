// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

admin.initializeApp();

export const registerUser = functions.https.onCall(
  async (request) => {
    // TODO(gracew): normalize phone number, make sure it hasn't already been registered
    const ref = admin.firestore().collection("users").doc();
    const user = { ...request, id: ref.id };
    await ref.set(user);
    return user;
  }
);
