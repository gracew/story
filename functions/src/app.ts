import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { CallableContext } from "firebase-functions/lib/providers/https";
import * as moment from "moment-timezone";
import { Firestore } from "./firestore";
import { parseTime, processTimeZone } from "./times";

// required fields
const REQUIRED_ONBOARDING_FIELDS = [
  "whereDidYouHearAboutUs",
  "firstName",
  "birthdate",
  "pronouns",
  "connectionType",
  "genderPreference",
  "location",
  "interests",
  "photo",
  "funFacts",
  "social",
];

// just checks for existence of fields - doesn't validate values
function onboardingComplete(data: Record<string, any>) {
  return REQUIRED_ONBOARDING_FIELDS.every(k => data[k] !== undefined);
}

export const onboardUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.phone_number) {
    throw new functions.https.HttpsError("unauthenticated", "authentication required");
  }

  const update: Record<string, any> = {};
  REQUIRED_ONBOARDING_FIELDS.forEach(field => {
    const value = data[field];
    if (value !== undefined) {
      update[field] = value;
      if (field === "birthdate") {
        // also calculate age
      } else if (field === "pronouns") {
        // set gender
      } else if (field === "genderPreference") {
        if (value === "Men") {
          update.genderPreference = ["Men"];
        }
        if (value === "Women") {
          update.genderPreference = ["Women"];
        }
        if (value === "Everyone") {
          update.genderPreference = ["Men", "Women"];
        }
      } else if (field === "location") {
        const tz = timezone(value);
        if (tz) {
          update.timezone = tz;
        }
      }
    }
  })

  if (Object.keys(update).length === 0) {
    return;
  }

  const userResult = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", context.auth.token.phone)
    .get();
  if (userResult.empty) {
    // create record
    const doc = admin.firestore().collection("users").doc();
    update.id = doc.id;
    update.phone = context.auth.token.phone;

    update.registeredAt = admin.firestore.FieldValue.serverTimestamp();
    update.onboardingComplete = onboardingComplete(update);
    update.eligible = true;
    update.status = "waitlist";
    await doc.create(update);

    if (update.phone.startsWith("+1")) {
      // US or Canada
      /*await client.messages.create({
        body: welcome(user as IUser),
        from: TWILIO_NUMBER,
        to: user.phone,
      });*/
    }
  } else {
    const user = userResult.docs[0];
    update.onboardingComplete = onboardingComplete({ ...user.data(), ...update });
    await user.ref.update(update);
  }
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
  if (!context.auth || !context.auth.token.phone_number) {
    throw new functions.https.HttpsError("unauthenticated", "authentication required");
  }
  const firestore = new Firestore();
  const userPromise = data.userId && context.auth.uid === "EfR3VzvvQHVAE1DbtQbCE546Q1F3"
    ? firestore.getUser(data.userId)
    : firestore.getUserByPhone(context.auth.token.phone_number);
  const user = await userPromise;
  if (!user) {
    throw new functions.https.HttpsError("not-found", "unknown user");
  }
  return user;
}

export const getPreferences = functions.https.onCall(async (data, context) => {
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
  } = await getUser(data, context)
  const prefs = await admin
    .firestore()
    .collection("preferences")
    .doc(id)
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

export const getVideoAvailabilityParameters = functions.https.onCall(async (data, context) => {
  const user = await getUser(data, context);
  const firestore = new Firestore();
  const match = await firestore.getMatch(data.matchId);
  if (!match) {
    throw new functions.https.HttpsError("not-found", "unknown match");
  }

  const otherUserId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
  const otherUser = await firestore.getUser(otherUserId);
  if (!otherUser) {
    throw new functions.https.HttpsError("internal", "unknown user");
  }

  return {
    tz: user.timezone,
    matchTz: otherUser.timezone,
    matchName: otherUser.firstName,
  };
});

export const saveVideoAvailability = functions.https.onCall(async (data, context) => {
  const user = await getUser(data, context);
  if (!data.matchId) {
    throw new functions.https.HttpsError("invalid-argument", "match id required");
  }
  const tz = processTimeZone(user.timezone);
  if (!tz) {
    throw new functions.https.HttpsError("internal", "could not process timezone for user " + user.id);
  }
  const times = data.selectedTimes.map((t: string) => parseTime(t, tz, moment))
  await admin.firestore().collection("matches").doc(data.matchId).update(`videoAvailability.${user.id}`, times);
  return {};
});
