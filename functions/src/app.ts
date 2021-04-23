import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { CallableContext } from "firebase-functions/lib/providers/https";
import { isEmpty } from "lodash";
import * as moment from "moment-timezone";
import fetch from "node-fetch";
import { createSmsChatHelper } from "./calls";
import { Firestore, IMatch, IPreferences, IUser, timestamp } from "./firestore";
import { findCommonAvailability } from "./scheduling";
import { cancelNotification, rescheduleNotification, videoFallbackSwapNumbers, videoFallbackTextChat, videoMatchNotification, welcome } from "./smsCopy";
import { processTimeZone, Timezone, videoTimeOptions } from "./times";
import { nextMatchNameAndDate, sendSms } from "./twilio";

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
        await sendSms({ body: welcome(user as IUser), to: user.phone });
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

  // check if we have already notified the users of the next step. this is to prevent additional texts if someone 
  // submits the availability form again
  const maybeMatch = await admin.firestore().runTransaction(async txn => {
    const matchRef = admin.firestore().collection("matches").doc(data.matchId);
    const matchDoc = await txn.get(matchRef);
    const match = matchDoc.data() as IMatch;
    if (!match || !match.videoAvailability) {
      console.error(new Error(`unexpected state: expected match ${data.matchId} to exist`));
      return;
    }
    if (Object.keys(match.videoAvailability).length !== 2) {
      return;
    }
    if (match.interactions.nextStepHandled === true) {
      console.info("already handled next step for match: " + match.id)
      return;
    }
    await txn.update(matchRef, "interactions.nextStepHandled", true);
    return match;
  });
  if (maybeMatch) {
    const otherUserId = maybeMatch.user_a_id === user.id ? maybeMatch.user_b_id : maybeMatch.user_a_id;
    const firestore = new Firestore();
    const otherUser = await firestore.getUser(otherUserId);
    const maybeNext = await videoNextStep(user, otherUser!, maybeMatch, sendSms);
    if (maybeNext) {
      // create new match in database
      await firestore.createMatch(maybeNext);
    }
  }
  return {};
});

export async function videoNextStep(userA: IUser, userB: IUser, match: IMatch, sendSmsFn: (opts: any) => Promise<any>) {
  const availabilityA = match.videoAvailability![match.user_a_id];
  const availabilityB = match.videoAvailability![match.user_b_id];
  const common = firstCommonAvailability(availabilityA.selectedTimes, availabilityB.selectedTimes);
  if (common) {
    // notify of the video call and return common time
    await Promise.all([
      sendSmsFn({
        body: videoMatchNotification(userA, userB, common),
        to: userA.phone,
      }),
      sendSmsFn({
        body: videoMatchNotification(userB, userA, common),
        to: userB.phone,
      }),
    ]);
    return {
      userAId: userA.id,
      userBId: userB.id,
      time: common,
      mode: "video",
    };
  }

  if (availabilityA.swapNumbers && availabilityB.swapNumbers) {
    // send texts to both users
    await Promise.all([
      sendSmsFn({
        body: videoFallbackSwapNumbers(userA, userB),
        to: userA.phone,
      }),
      sendSmsFn({
        body: videoFallbackSwapNumbers(userB, userA),
        to: userB.phone,
      }),
    ]);
    return;
  }

  // connect in text chat
  await Promise.all([
    sendSmsFn({
      body: videoFallbackTextChat(userA, userB),
      to: userA.phone,
    }),
    sendSmsFn({
      body: videoFallbackTextChat(userB, userA),
      to: userB.phone,
    }),
  ]);
  await createSmsChatHelper(userA, userB, match);
  return;
}

export function firstCommonAvailability(a1: string[], a2: string[]) {
  if (a1.length === 0 || a2.length === 0) {
    return undefined;
  }
  const set = new Set(a1.map(s => new Date(s).getTime()));
  const common = a2.filter(s => set.has(new Date(s).getTime()));
  common.sort((a, b) => a < b ? -1 : 1);
  return common[0]; // this returns undefined if common has length 0
}

async function checkUserIsInMatch(firestore: Firestore, userId: string, matchId: string) {
  const match = await firestore.getMatch(matchId);
  if (!match) {
    throw new functions.https.HttpsError("invalid-argument", "unknown match id");
  }
  if (!match.user_ids.includes(userId)) {
    throw new functions.https.HttpsError("permission-denied", "unauthorized to cancel match");
  }
  return match;
}

export const getCommonAvailability = functions.https.onCall(async (data, context) => {
  const user = await getUser(data, context);
  if (!data.matchId) {
    throw new functions.https.HttpsError("invalid-argument", "match id required");
  }

  const firestore = new Firestore();
  const match = await checkUserIsInMatch(firestore, user.id, data.matchId);
  const week = moment().startOf("week").format("YYYY-MM-DD");
  const availability = await firestore.getSchedulingRecords(week, match.user_ids);
  const common = findCommonAvailability(availability[match.user_a_id].available, availability[match.user_b_id].available);
  const now = moment().toDate().getTime();
  return common.filter(date => date.getTime() > now);
});

export const rescheduleMatch = functions.https.onCall(async (data, context) => {
  const user = await getUser(data, context);
  if (!data.matchId) {
    throw new functions.https.HttpsError("invalid-argument", "match id required");
  }

  const firestore = new Firestore();
  const match = await checkUserIsInMatch(firestore, user.id, data.matchId);
  const otherUserId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
  const otherUser = await firestore.getUser(otherUserId);
  if (!otherUser) {
    throw new functions.https.HttpsError("internal", "match references unknown user id " + otherUserId);
  }

  await Promise.all([
    // update time and set rescheduled flag
    firestore.updateMatch(match.id, {
      created_at: timestamp(data.newTime),
      rescheduled: true,
    }),
    // notify the other user
    sendSms({
      body: rescheduleNotification(
        otherUser,
        user,
        match,
        moment,
        data.newTime,
      ),
      to: otherUser.phone,
    })
  ])
  return {};
});

export const cancelMatch = functions.https.onCall(async (data, context) => {
  const user = await getUser(data, context);
  if (!data.matchId) {
    throw new functions.https.HttpsError("invalid-argument", "match id required");
  }

  const firestore = new Firestore();
  const match = await checkUserIsInMatch(firestore, user.id, data.matchId);
  await firestore.cancelMatch(match.id);

  // notify the cancelee
  const canceleeId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;
  const cancelee = await firestore.getUser(canceleeId);
  if (!cancelee) {
    throw new functions.https.HttpsError("internal", "match references unknown user id " + canceleeId);
  }

  const canceleeNextMatch = await firestore.nextMatchForUser(canceleeId);
  await sendSms({
    body: cancelNotification(
      cancelee,
      user,
      match,
      moment,
      await nextMatchNameAndDate(canceleeId, firestore, canceleeNextMatch),
    ),
    to: cancelee.phone,
  });
  return {};
});
