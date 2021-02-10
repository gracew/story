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
  const {
    firstName,
    gender,
    age,
    location,
    locationFlexibility,
    matchMin,
    matchMax,
    genderPreference,
    funFacts
  } = user.docs[0].data();
  const prefs = await admin
    .firestore()
    .collection("preferences")
    .doc(user.docs[0].id)
    .get();
  return {
    firstName,
    gender,
    age,
    matchMin,
    matchMax,
    location: {
      value: location,
    },
    locationFlexibility: {
      value: locationFlexibility ? "Yes" : "No",
    },
    genderPreference: {
      value: genderPreference.length === 1 ? genderPreference[0] : "Everyone",
    },
    funFacts: {
      value: funFacts,
    },
    ...prefs.data()
  };
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

  const {
    matchMin,
    matchMax,
    location,
    locationFlexibility,
    genderPreference,
    ...otherPrefs
  } = data;

  const mainPrefs: Record<string, any> = {};
  if (matchMin !== undefined) {
    mainPrefs.matchMin = matchMin;
  }
  if (matchMax !== undefined) {
    mainPrefs.matchMax = matchMax;
  }
  if (locationFlexibility !== undefined) {
    mainPrefs.locationFlexibility = locationFlexibility.value === "Yes";
  }
  if (genderPreference !== undefined) {
    if (genderPreference.value === "Men") {
      mainPrefs.genderPreference = ["Men"];
    } 
    if (genderPreference.value === "Women") {
      mainPrefs.genderPreference = ["Women"];
    }
    if (genderPreference.value === "Everyone") {
      mainPrefs.genderPreference = ["Men", "Women"];
    }
  }
  if (Object.keys(mainPrefs).length > 0) {
    await admin
      .firestore()
      .collection("users")
      .doc(user.docs[0].id)
      .update(mainPrefs);
  }

  if (Object.keys(otherPrefs).length > 0) {
    await admin
      .firestore()
      .collection("preferences")
      .doc(user.docs[0].id)
      .update(otherPrefs);
  }
});
