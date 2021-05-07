import * as express from "express";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment";
import { Requests } from "../../api/functions";
import { createSmsChatHelper } from "./app";
import { Firestore, IUser } from "./firestore";

function validateSharedSecret(request: express.Request) {
  const expected = functions.config().admin.shared_secret;
  const sharedSecret = request.header("X-Story-Shared-Secret") as string;
  if (expected !== sharedSecret) {
    throw new functions.https.HttpsError("permission-denied", "not authorized");
  }
}

export const callUser = functions.https.onRequest(async (request, response) => {
  validateSharedSecret(request);
  await callUserHelper(request.body.userId);
  response.end();
});

export const createSmsChat = functions.https.onRequest(async (request, response) => {
  validateSharedSecret(request);
  const firestore = new Firestore();
  const match = await firestore.getMatch(request.body.matchId);
  if (!match) {
    response.end();
    return;
  }

  const usersById = await firestore.getUsersForMatches([match]);
  const userA = usersById[match.user_a_id];
  const userB = usersById[match.user_b_id];

  await createSmsChatHelper(userA, userB, match);

  response.end();
});

// TODO: add a match response for API
// possibly validate that the match time is allowed?
export const createMatch = functions.https.onRequest(
  async ({ body }: { body: Requests.CreateMatch }, response) => {
    const match = await new Firestore().createMatch({
      ...body,
      time: new Date(body.time),
    });
    response.send(match);
  }
);

/** Used in each round to determine which users should be included (based on number of potential matches). */
export const remainingMatches = functions.https.onRequest(
  async (request, response) => {
    validateSharedSecret(request);
    const excludeIds = request.body.excludeIds || [];
    const usersRaw = await admin.firestore().collection("users").where("status", "in", ["waitlist", "contacted", "pause", "resurrected"]).get();
    const users = usersRaw.docs.filter(d => !excludeIds.includes(d.id)).map(d => formatUser(d));
    const [prevMatches, blocklist, optInLikelihood] = await Promise.all([getPrevMatches(), getBlocklist(), getOptInLikelihood()]);

    const results = [];
    for (const user of users) {
      const remaining = users.filter(match => areUsersCompatible(user, match, prevMatches, blocklist));
      const remainingSameTz = remaining.filter(match => match.timezone === user.timezone);

      const remainingLikely = remaining.reduce((acc, u) => acc + (optInLikelihood[u.id] || 0), 0);
      const remainingSameTzLikely = remainingSameTz.reduce((acc, u) => acc + (optInLikelihood[u.id] || 0), 0);

      results.push({
        ...user,
        optInLikelihood: optInLikelihood[user.id],
        remainingMatches: remaining.map(u => u.firstName + " " + u.lastName),
        remainingMatchesSameTz: remainingSameTz.map(u => u.firstName + " " + u.lastName),
        remainingLikely,
        remainingSameTzLikely,
        // @ts-ignore
        prevMatches: prevMatches[user.id],
      });
    }

    response.send(results);
  }
);

async function getOptInLikelihood() {
  // check the last 4 weeks of history
  const optIns: Record<string, number> = {};
  const count: Record<string, number> = {};
  for (let i = 1; i <= 4; i++) {
    const week = moment().startOf("week").subtract(i, "weeks").format("YYYY-MM-DD");
    const results = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
    results.forEach(doc => {
      if (!(doc.id in count)) {
        count[doc.id] = 0;
      }
      count[doc.id]++;

      const available = doc.get("available");
      if (available && available.length > 0) {
        if (!(doc.id in optIns)) {
          optIns[doc.id] = 0;
        }
        optIns[doc.id]++;
      }
    })
  }
  const likelihood: Record<string, number> = {};
  Object.entries(count).forEach(([userId, n]) => {
    likelihood[userId] = (optIns[userId] || 0) / n;
  })
  return likelihood;
}

/** Used in each round after obtaining availability to generate matches. */
export const potentialMatches = functions.https.onRequest(
  async (request, response) => {
    validateSharedSecret(request);
    const result = await potentialMatchesHelper(request.body.schedulingView);
    response.send(result);
  }
);

function formatUser(d: any) {
  const o = d.data();
  return {
    ...o,
    matchMax: o.matchMax || defaultMatchMax(o.gender, o.age),
    matchMin: o.matchMin || defaultMatchMin(o.gender, o.age),
  };
}

async function getPrevMatches() {
  const matches = await admin.firestore().collection("matches").where("canceled", "==", false).get();
  const ret: Record<string, string[]> = {};
  matches.forEach(m => {
    const data = m.data();
    if (!(data.user_a_id in ret)) {
      ret[data.user_a_id] = [];
    }
    ret[data.user_a_id].push(data.user_b_id);

    if (!(data.user_b_id in ret)) {
      ret[data.user_b_id] = [];
    }
    ret[data.user_b_id].push(data.user_a_id);
  })
  return ret;
}

async function getBlocklist() {
  const blocklists = await admin.firestore().collection("blocklist").get();
  const ret: Record<string, string[]> = {};
  blocklists.forEach(b => {
    const [id1, id2] = b.get("userIds");

    if (!(id1 in ret)) {
      ret[id1] = [];
    }
    ret[id1].push(id2);

    if (!(id2 in ret)) {
      ret[id2] = [];
    }
    ret[id2].push(id1);
  })
  return ret;
}

async function potentialMatchesHelper(week: string) {
  const availability = await admin.firestore().collection("scheduling").doc(week).collection("users").get();
  const availabilityByUserId = Object.assign({}, ...availability.docs.map(doc => ({ [doc.id]: doc.data() })))

  const userRefs = availability.docs.map(doc => admin.firestore().collection("users").doc(doc.id));
  const users = (await admin.firestore().getAll(...userRefs)).map(d => formatUser(d));

  const pairs = [];
  const [prevMatches, blocklist] = await Promise.all([getPrevMatches(), getBlocklist()]);
  for (const [userA, userB] of generatePairs(users)) {
    if (!areUsersCompatible(userA, userB, prevMatches, blocklist)) {
      continue;
    }
    const sharedAvailability = findCommonAvailability(availabilityByUserId[userA.id].available, availabilityByUserId[userB.id].available);
    if (sharedAvailability.length > 0) {
      pairs.push({
        userA,
        userB,
        sameLocation: userA.location === userB.location,
        userAPrevMatches: (prevMatches[userA.id] || []).length,
        userBPrevMatches: (prevMatches[userB.id] || []).length,
        days: sharedAvailability
      });
    }
  }
  return pairs;
}

export function findCommonAvailability(a1?: admin.firestore.Timestamp[], a2?: admin.firestore.Timestamp[]) {
  if (!a1 || !a2) {
    return [];
  }
  const set = new Set(a1.map(t => t.toDate().toISOString()));
  return a2.map(t => t.toDate()).filter(d => set.has(d.toISOString()));
}

// returns all possible pairings of an array
function generatePairs(array: any[]) {
  return array.reduce((acc, v, i) =>
    acc.concat(array.slice(i + 1).map(w => [v, w])),
    []);
}

function defaultMatchMax(gender: string, age: number) {
  return gender === "Female" ? age + 6 : age + 4
}

function defaultMatchMin(gender: string, age: number) {
  return gender === "Female" ? age - 2 : age - 4
}

export function checkGenderPreference(user: IUser, match: IUser) {
  switch (user.genderPreference) {
    case "Everyone":
      return true;
    case "Men":
      return match.gender === "Male";
    case "Women":
      return match.gender === "Female";
    default:
      return false;
  }
}

function areUsersCompatible(user: IUser, match: IUser, prevMatches: Record<string, string[]>, blocklist: Record<string, string[]>) {
  // ensure user isn't matching with self
  if (user.id === match.id) {
    return false;
  }

  // check if match meets user's age criteria
  if (match.age > (user.matchMax + 1) || match.age < (user.matchMin - 1)) {
    return false;
  }

  // check if user meets match's age criteria
  if (user.age > (match.matchMax + 1) || user.age < (match.matchMin - 1)) {
    return false;
  }

  // check gender
  if (!checkGenderPreference(user, match) || !checkGenderPreference(match, user)) {
    return false;
  }

  // if users are in different locations, check if both are flexible. defaults to true if flexibility is unknown
  if (match.location !== user.location) {
    if (match.locationFlexibility === false || user.locationFlexibility === false) {
      return false;
    }
  }

  // If user has previous matches or blocklist, filter them out of results
  if ((prevMatches[user.id] || []).includes(match.id)) {
    return false;
  }
  if ((blocklist[user.id] || []).includes(match.id)) {
    return false;
  }

  return true;
}
function callUserHelper(userId: any) {
  throw new Error("Function not implemented.");
}

