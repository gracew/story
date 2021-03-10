import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { CallableContext } from "firebase-functions/lib/providers/https";

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

export const getPublicProfile = functions.https.onCall(async (data, context) => {
  const user = await admin
    .firestore()
    .collection("users")
    .doc(data.userId)
    .get();
  const {
    firstName,
    photo,
    gender,
    funFacts,
  } = user.data() as any;
  return {
    firstName,
    photo,
    gender,
    funFacts,
  };
});

async function getUser(data: any, context: CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "authentication required");
  }
  if (data.userId && context.auth.uid === "EfR3VzvvQHVAE1DbtQbCE546Q1F3") {
    return admin
      .firestore()
      .collection("users")
      .doc(data.userId)
      .get();
  }

  const users = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", context.auth.token.phone_number)
    .get();
  if (users.empty) {
    throw new functions.https.HttpsError("not-found", "unknown user");
  }
  return users.docs[0];
}

export const getPreferences = functions.https.onCall(async (data, context) => {
  const user = await getUser(data, context);
  const {
    id,
    beta,
    firstName,
    gender,
    age,
    location,
    locationFlexibility,
    matchMin,
    matchMax,
    genderPreference,
    funFacts,
    photo,
  } = user.data() as any;
  const prefs = await admin
    .firestore()
    .collection("preferences")
    .doc(user.id)
    .get();
  return {
    id,
    beta,
    firstName,
    photo,
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
  const user = await getUser(data, context);

  const {
    photo,
    matchMin,
    matchMax,
    location,
    locationFlexibility,
    genderPreference,
    funFacts,
    userId,
    ...otherPrefs
  } = data;

  const mainPrefs: Record<string, any> = {};
  if (photo !== undefined) {
    mainPrefs.photo = photo;
  }
  if (matchMin !== undefined) {
    mainPrefs.matchMin = matchMin;
  }
  if (matchMax !== undefined) {
    mainPrefs.matchMax = matchMax;
  }
  if (location !== undefined) {
    mainPrefs.location = location.value;
    const tz = timezone(location.value);
    if (tz) {
      mainPrefs.timezone = tz;
    } 
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
  if (funFacts !== undefined) {
    mainPrefs.funFacts = funFacts.value;
  }

  if (Object.keys(mainPrefs).length > 0) {
    await admin
      .firestore()
      .collection("users")
      .doc(user.id)
      .update(mainPrefs);
  }
  if (Object.keys(otherPrefs).length > 0) {
    await admin
      .firestore()
      .collection("preferences")
      .doc(user.id)
      .set(otherPrefs, { merge: true });
  }
});

function timezone(location: string) {
  const map: Record<string, string> = {
    "Boston": "ET",
    "Chicago": "CT",
    "Los Angeles": "PT",
    "New York City": "ET",
    "Philadelphia": "ET",
    "San Diego": "PT",
    "San Francisco Bay Area": "PT",
    "Seattle": "PT",
    "Toronto": "ET",
    "Washington, DC": "ET",
  }
  return map[location];
}