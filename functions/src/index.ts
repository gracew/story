import * as functions from "firebase-functions";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
const admin = require("firebase-admin");
admin.initializeApp();

export const registerUser = functions.https.onRequest(
  async (request, response) => {
    const { blob, ...other } = request.body;
    await admin.firestore().collection("users").doc().set(other);
    response.send("Done");
  }
);
