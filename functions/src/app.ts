import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { CallableContext } from "firebase-functions/lib/providers/https";
import * as moment from "moment-timezone";
import fetch from "node-fetch";
import {Firestore, IPreferences, IUser} from "./firestore";
import { processTimeZone, Timezone, videoTimeOptions } from "./times";
import { isEmpty } from "lodash";

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
] as const;

// just checks for existence of fields - doesn't validate values
function checkOnboardingComplete(user: Partial<IUser>) {
  return REQUIRED_ONBOARDING_FIELDS.every(k => user[k] !== undefined);
}

function parseOnboardingForm(data: Record<string, any>): [Partial<IUser> | undefined, Partial<IPreferences> | undefined] {
  const userUpdate: Record<string, any> = {};
  const preferencesUpdate: Partial<IPreferences> = {};
  REQUIRED_ONBOARDING_FIELDS.forEach(field => {
    const value = data[field];
    if (value === undefined) {
      return;
    }

    userUpdate[field] = value;
    if (field === "birthdate") {
      // also calculate age
      const formatted = `${value.year}-${value.month}-${value.day}`;
      userUpdate.age = moment().diff(formatted, "years");
    } else if (field === "pronouns") {
      // also set gender
      switch (value) {
        case "He/him":
          userUpdate.gender = "Male";
          break;
        case "She/her":
          userUpdate.gender = "Female";
          break;
        case "They/them":
          userUpdate.gender = "Non-binary";
          break;
        default:
          console.error(new Error("unknown pronouns: " + value));
      }
    } else if (field === "location") {
      const tz = timezone(value);
      if (tz) {
        userUpdate.timezone = tz;
      }
    }
  });

  if (data.referrer !== undefined) {
    userUpdate.referrer = data.referrer;
  }

  if (data.connectionType !== undefined) {
    preferencesUpdate.connectionType = { value: data.connectionType };
  }

  return [
    isEmpty(userUpdate) ? undefined : userUpdate,
    isEmpty(preferencesUpdate) ? undefined : preferencesUpdate
  ];
}

export const onboardUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.phone_number) {
    throw new functions.https.HttpsError("unauthenticated", "authentication required");
  }

  const firestore = new Firestore();
  const user = await firestore.getOrCreateUser(context.auth.token.phone_number);

  // if they already completed onboarding, they have no business doing anything onboarding. bail out
  if (user.onboardingComplete) {
      return;
  }

  const [userUpdate, preferencesUpdate] = parseOnboardingForm(data);
  if (userUpdate) {
    const wasOnboardingComplete = user.onboardingComplete;
    Object.assign(user, userUpdate);
    user.onboardingComplete = checkOnboardingComplete(user);
    await firestore.saveUser(user);
    if (!wasOnboardingComplete && user.onboardingComplete) {
      await notifyNewSignup(user);
      // US and Canada
      if (user.phone.startsWith("+1")) {
        await sendSms({body: welcome(user as IUser), to: user.phone});
      }
    }
  }
  if (preferencesUpdate) {
    await firestore.setPreferences(user.id, preferencesUpdate);
  }
  return { id: user.id, phone: user.phone };
});

function notifyNewSignup(user: Record<string, any>) {
  const text = `New user signup

Name: ${user.firstName}
Gender: ${user.gender}
Wants to meet: ${user.genderPreference} 
Age: ${user.age}
Location: ${user.location}
Channel: ${user.whereDidYouHearAboutUs.option}, ${user.whereDidYouHearAboutUs.context}
Referrer: ${user.referrer}`;
  // So we mostly only see real signups in Slack
  if (process.env.NODE_ENV !== "production") {
    console.log(text);
    return Promise.resolve();
  }

  const slack_signup_webhook_url = functions.config().slack?.signup_webhook_url;
  if (!slack_signup_webhook_url) {
    console.error(new Error("Slack signup webhook not configured"));
    return Promise.resolve();
  }
  return fetch(slack_signup_webhook_url, {
    method: "post",
    body: JSON.stringify({ text }),
    headers: { "Content-Type": "application/json" },
  }).catch(console.error);
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
    onboardingComplete,
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
    // for onboarding
    whereDidYouHearAboutUs,
    birthdate,
    pronouns,
    interests,
    social,
  } = await getUser(data, context)
  const prefs = await admin
    .firestore()
    .collection("preferences")
    .doc(id)
    .get();
  return {
    id,
    onboardingComplete,
    beta,
    firstName,
    photo,
    gender,
    age,
    matchMin,
    matchMax,
    whereDidYouHearAboutUs,
    birthdate,
    pronouns,
    interests,
    social,
    location: {
      value: location,
    },
    locationFlexibility: {
      value: locationFlexibility ? "Yes" : "No",
    },
    genderPreference: {
      value: genderPreference,
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
    mainPrefs.genderPreference = genderPreference.value;
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

export const getVideoAvailability = functions.https.onCall(async (data, context) => {
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

  const tz = processTimeZone(user.timezone);
  if (!tz) {
    throw new functions.https.HttpsError("internal", "could not process timezone for user " + user.id);
  }
  const videoAvailability = match.videoAvailability ? match.videoAvailability[user.id] : undefined;
  return {
    tz: user.timezone,
    matchName: otherUser.firstName,
    timeOptions: videoTimeOptions(user.timezone as Timezone, otherUser.timezone as Timezone, moment),
    ...videoAvailability,
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
  await admin.firestore()
    .collection("matches")
    .doc(data.matchId)
    .update(`videoAvailability.${user.id}`, { selectedTimes: data.selectedTimes, swapNumbers: data.swapNumbers });
  return {};
});
