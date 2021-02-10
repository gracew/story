import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

/**
 * Used by the frontend to look up metadata for a user based on username (e.g. when navigating to storydating.com/grace).
 */
export const getUserByUsername = functions.https.onCall(async (data) => {
  const user = await admin
    .firestore()
    .collection("users")
    .where("username", "==", data.username)
    .get();
  if (user.empty) {
    throw new functions.https.HttpsError("not-found", "unknown username");
  }
  const { firstName, age, bio, prompt, gender } = user.docs[0].data();
  return { firstName, age, bio, prompt, gender };
});

export const getPreferences = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "authentication required");
  }
  const user = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", context.auth.token.phone_number)
    .get();
  if (user.empty) {
    throw new functions.https.HttpsError("not-found", "unknown user");
  }
  const prefs = await admin
    .firestore()
    .collection("preferences")
    .doc(user.docs[0].id)
    .get();
  return prefs.data();
});

export const savePreferences = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "authentication required");
  }
  const user = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", context.auth.token.phone_number)
    .get();
  if (user.empty) {
    throw new functions.https.HttpsError("not-found", "unknown user");
  }

  await admin
    .firestore()
    .collection("preferences")
    .doc(user.docs[0].id)
    .update(data.prefs);
});
