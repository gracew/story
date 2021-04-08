import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { CallableContext } from "firebase-functions/lib/providers/https";
import * as moment from "moment-timezone";
import fetch from "node-fetch";
import { Firestore, IUser } from "./firestore";
import { welcome } from "./smsCopy";
import { parseTime, processTimeZone } from "./times";
import { client, TWILIO_NUMBER } from "./twilio";

// required fields
const REQUIRED_ONBOARDING_FIELDS = [
  "whereDidYouHearAboutUs",
  "firstName",
  "birthdate",
  "pronouns",
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

async function getOrCreateUser(phone: string) {
  const userResult = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", phone)
    .get();
  if (userResult.empty) {
    // create record
    const doc = admin.firestore().collection("users").doc();
    const data = {
      id: doc.id,
      phone,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      eligible: true,
      status: "waitlist",
      locationFlexibility: true,
    };
    await doc.create(data);
    return data;
  }
  return userResult.docs[0].data();
}

export const onboardUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.phone_number) {
    throw new functions.https.HttpsError("unauthenticated", "authentication required");
  }

  const user = await getOrCreateUser(context.auth.token.phone_number);

  const update: Record<string, any> = {};
  REQUIRED_ONBOARDING_FIELDS.forEach(field => {
    const value = data[field];
    if (value === undefined) {
      return;
    }

    update[field] = value;
    if (field === "birthdate") {
      // also calculate age
      const formatted = `${value.year}-${value.month}-${value.day}`;
      update.age = moment().diff(formatted, "years");
    } else if (field === "pronouns") {
      // also set gender
      switch (value) {
        case "He/him":
          update.gender = "Male";
          break;
        case "She/her":
          update.gender = "Female";
          break;
        case "They/them":
          update.gender = "Non-binary";
          break;
        default:
          console.error(new Error("unknown pronouns: " + value));
      }
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
  })

  if (data.referrer !== undefined) {
    update.referrer = data.referrer;
  }

  if (Object.keys(update).length > 0) {
    const allData = { ...user, ...update };
    update.onboardingComplete = onboardingComplete(allData);
    await admin.firestore().collection("users").doc(user.id).update(update);
    if (update.onboardingComplete) {
      await notifyNewSignup(allData);
      if (user.phone.startsWith("+1") && !isTestNumber(user.phone)) {
        // US or Canada
        await client.messages.create({
          body: welcome(user as IUser),
          from: TWILIO_NUMBER,
          to: user.phone,
        });
      }
    }
  }

  if (data.connectionType !== undefined) {
    await admin.firestore().collection("preferences").doc(user.id).set({
      connectionType: { value: data.connectionType }
    });
  }

  return { id: user.id, phone: user.phone };
});

function isTestNumber(phone: string) {
  return ["+16501111111", "+16502222222"].includes(phone);
}

function notifyNewSignup(user: Record<string, any>) {
  const text = `New user signup

Name: ${user.firstName}
Gender: ${user.gender}
Wants to meet: ${user.genderPreference} 
Age: ${user.age}
Location: ${user.location}
Channel: ${user.whereDidYouHearAboutUs.option}, ${user.whereDidYouHearAboutUs.context}
Referrer: ${user.referrer}`
  return fetch(functions.config().slack.signup_webhook_url, {
    method: "post",
    body: JSON.stringify({ text }),
    headers: { "Content-Type": "application/json" },
  });
}

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
