import * as firestore from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import * as os from "os";
import * as path from "path";
import * as twilio from "twilio";
import * as util from "util";
import {
  createMatchFirestore,
  processAvailabilityCsv,
  processBulkSmsCsv,
  processMatchCsv
} from "./csv";
import { Firestore, IMatch, IUser } from "./firestore";
import {
  bipartite,
  generateAvailableMatches,
  generateRemainingMatchCount
} from "./remainingMatches";
import { sendWelcomeEmail } from "./sendgrid";
import { flakeApology, flakeWarning, reminder, videoReminder } from "./smsCopy";
import {
  BASE_URL,
  callStudio,
  client,
  getConferenceTwimlForPhone,
  saveRevealHelper,
  sendSms,
  TWILIO_NUMBER
} from "./twilio";
import { analyzeCollection as analyzeCollectionHelper } from "./validateMatches2";


admin.initializeApp();

export const analyzeCollection = functions.https.onRequest(
  async (req, response) => {
    const analysis = await analyzeCollectionHelper(req.body.collectionName);
    response.send(analysis);
  }
);

/** Used by the frontend to verify that the phone number hasn't already been registered. */
export const phoneRegistered = functions.https.onCall(async (request) => {
  const normalizedPhone = request.phone.split(" ").join("");

  // make sure the phone number hasn't already been registered
  const existingUser = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", normalizedPhone)
    .get();
  return !existingUser.empty;
});

/**
 * Used by the frontend to look up metadata for a user based on username (e.g. when navigating to storydating.com/grace).
 */
export const getUserByUsername = functions.https.onCall(async (request) => {
  const user = await admin
    .firestore()
    .collection("users")
    .where("username", "==", request.username)
    .get();
  if (user.empty) {
    throw new functions.https.HttpsError("not-found", "unknown username");
  }
  const { firstName, age, bio, prompt, gender } = user.docs[0].data();
  return { firstName, age, bio, prompt, gender };
});

/** Called upon typeform submission to save user data in firebase and airtable. */
export const registerUser = functions.https.onRequest(async (req, response) => {
  const answersIdMap: { [key: string]: string } = {
    "bc7dad0e-d1ee-42d5-b9b0-4b15b5d1b102": "firstName",
    "e9ad7465-f6cf-457f-8679-ff188616e43e": "lastName",
    "6fa1f2c6-a197-4509-bd40-561be56369ae": "age",
    "2a7363b5-ef3d-409d-9a4b-7e673ac70cb5": "gender",
    "c0e58906-8dc5-4471-a528-8e2290186ef0": "race",
    "b67c3eee-a90d-4302-a710-6556829b6817": "email",
    "6775fb10-e9a5-4ea6-909a-c939fed72695": "location",
    "ff785a0b-f3a0-4406-aa13-ea266e9bb2d7": "locationFlexibility",
    "3a3112de-77a8-40e8-bce8-3f7fec4bb6dd": "matchMin",
    "f88f7eef-745f-415d-8675-307965e200d6": "matchMax",
    "a5199299-4665-4e9b-87c7-eac644077f28": "phone",
    "1cb2d597-5a52-406b-bc12-45bdea0d877f": "genderPreference",
    "34932f3b-5120-47c2-8053-1c61c3f5ff6f": "funFacts",
    "ead263db-6980-4ebe-9bc4-2956ce894fd3": "interests",
    "4cef01ee-ed52-48b4-8f2b-902d38dafcf0": "social",
    "1b6b3940-ba10-46f3-bd8b-17b7f32e93f8": "whereDidYouHearAboutStory",
  };

  const user: { [key: string]: any } = {
    referrer: req.body.form_response.hidden.r,
    signUpDate: req.body.form_response.submitted_at,
    eligible: true,
    status: "waitlist",
  };

  const answers = req.body.form_response.answers;

  for (const a of answers) {
    const refff: string = a.field.ref;
    const key = answersIdMap[refff];
    if (!key) {
      continue;
    }
    if (
      a.type === "text" ||
      a.type === "boolean" ||
      a.type === "email" ||
      a.type === "number" ||
      a.type === "phone_number" ||
      a.type === "long_text" ||
      a.type === "short_text"
    ) {
      user[key] = a[a.type];
    } else if (a.type === "choice") {
      user[key] = a.choice.label ? a.choice.label : a.choice.other;
    } else if (a.type === "choices") {
      user[key] = a.choices.labels;
    }
  }

  user.phone = user.phone.split(" ").join("");
  if (user.location === "San Francisco Bay Area") {
    user.timezone = "PT";
  } else if (user.location === "New York City") {
    user.timezone = "ET";
  }

  // overwrite genderPreference to match previous multiple selection format
  switch (user.genderPreference) {
    case "Men":
      user.genderPreference = ["Men"];
      break;
    case "Women":
      user.genderPreference = ["Women"];
      break;
    case "Everyone":
      user.genderPreference = ["Men", "Women"];
      break;
    default:
      console.warn("unknown genderPreference: " + user.genderPreference);
  }

  // make sure the phone number hasn't already been registered
  const ue = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", user.phone)
    .get();
  if (!ue.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "phone number has already been registered"
    );
  }

  const reff = admin.firestore().collection("users").doc();
  user.id = reff.id;
  user.registeredAt = admin.firestore.FieldValue.serverTimestamp();
  await reff.set(user);
  if (user.phone.length === 12 && user.phone.startsWith("+1")) {
    // US or Canada
    await sendWelcomeText(user as IUser);
  } else {
    await sendWelcomeEmail(user as IUser);
  }

  response.end();
});

async function sendWelcomeText(user: IUser) {
  const body = `Hi ${user.firstName}, thanks for joining Story Dating! Think of us as a personalized matchmaker that finds great matches for you and handles all of the scheduling. You're currently on the waitlist, but we'll notify you as soon as we have some matches we think you'll like. In the meantime, feel free to text us with any questions, and refer your friends with this link to get off the waitlist sooner: https://storydating.com/join?r=${user.id}`;
  await client.messages.create({
    body,
    from: TWILIO_NUMBER,
    to: user.phone,
  });
}

/** Used in each round to determine which users should be included (based on number of potential matches). */
export const generateRemainingMatchReport = functions.https.onRequest(
  async (request, response) => {
    const result = await generateRemainingMatchCount(
      request.body.excludeIds || []
    );
    response.send(result);
  }
);

/** Used in each round after obtaining availability to generate matches. */
export const generateMatchesUsingAvailability = functions.https.onRequest(
  async (request, response) => {
    const result = await generateAvailableMatches(
      request.body.schedulingView,
      request.body.tz
    );
    response.send(result);
  }
);

export const bipartiteAvailability = functions.https.onRequest(
  async (request, response) => {
    const result = await bipartite(
      request.body.schedulingView,
      request.body.tz
    );
    response.send(result);
  }
);

/**
 * Sends an SMS for each row in a CSV. The CSV should be in the format: phone,textBody. There should not be a header
 * line.
 */
export const bulkSms = functions.storage.object().onFinalize(async (object) => {
  if (!(object.name && object.name.startsWith("bulksms"))) {
    return;
  }
  const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
  await admin
    .storage()
    .bucket(object.bucket)
    .file(object.name)
    .download({ destination: tempFilePath });
  await processBulkSmsCsv(tempFilePath, sendSms);
});

/**
 * Sends an availability text for each row in a CSV. The CSV should be in the format: userId,timezone. The timezone
 * value will be directly inserted into the text and should be of the form "PT". There should not be a header line.
 */
export const sendAvailabilityTexts = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (!(object.name && object.name.startsWith("availability"))) {
      return;
    }
    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    await admin
      .storage()
      .bucket(object.bucket)
      .file(object.name)
      .download({ destination: tempFilePath });
    await processAvailabilityCsv(tempFilePath, new Firestore(), sendSms);
  });

/**
 * Creates a match for each row in a CSV. The CSV should be in the format:
 * userAId,userBId,callDate (MM-DD-YYYY),callTime (hh:mm a),timezone. There should not be a header line.
 */
export const createMatches = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (!(object.name && object.name.startsWith("matchescsv"))) {
      return;
    }

    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    await admin
      .storage()
      .bucket(object.bucket)
      .file(object.name)
      .download({ destination: tempFilePath });

    await processMatchCsv(tempFilePath, new Firestore(), sendSms);
  });

export const createMatch = functions.https.onRequest(
  async (request, response) => {
    const match = await createMatchFirestore(request.body, new Firestore());
    response.send(match);
  }
);

export const cancelMatch = functions.https.onRequest(
  async (request, response) => {
    await admin
      .firestore()
      .collection("matches")
      .doc(request.body.id)
      .update("canceled", true);
    response.end();
  }
);

// runs every hour
export const sendReminderTexts = functions.pubsub
  .schedule("0,30 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour").add(1, "hour");
    if (moment().minutes() >= 30) {
      createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("reminded", "==", false)
          .where("canceled", "==", false)
      );
      console.log(
        "found the following matches: " + matches.docs.map((doc) => doc.id)
      );

      const userAIds = matches.docs.map((doc) => doc.get("user_a_id"));
      const userBIds = matches.docs.map((doc) => doc.get("user_b_id"));
      const userIds = userAIds.concat(userBIds);
      console.log("sending texts to the following users: " + userIds);

      if (userIds.length === 0) {
        return;
      }
      const users = await txn.getAll(
        ...userIds.map((id) => admin.firestore().collection("users").doc(id))
      );

      const usersById = Object.assign(
        {},
        ...users.map((user) => ({ [user.id]: user.data() }))
      );

      const allPromises: Array<Promise<any>> = [];
      matches.docs.forEach((doc) => {
        const userA = usersById[doc.get("user_a_id")];
        const userB = usersById[doc.get("user_b_id")];
        const video = doc.get("mode") === "video";
        allPromises.push(textUserHelper(userA, userB, video));
        allPromises.push(textUserHelper(userB, userA, video));
      });

      await Promise.all(allPromises);
      await Promise.all(
        matches.docs.map((doc) => txn.update(doc.ref, "reminded", true))
      );
    });
  });

async function textUserHelper(userA: IUser, userB: IUser, video: boolean) {
  const body = video
    ? videoReminder(userA, userB)
    : await reminder(userA, userB);
  await client.messages.create({
    body,
    from: TWILIO_NUMBER,
    to: userA.phone,
  });
}

export const sendVideoLink = functions.pubsub
  .schedule("55 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour").add(1, "hour");
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("called", "==", false)
          .where("canceled", "==", false)
      );
      const videoMatches = matches.docs.filter(
        (doc) => doc.get("mode") === "video"
      );
      console.log(
        "found the following matches: " + videoMatches.map((doc) => doc.id)
      );

      const userAIds = videoMatches.map((doc) => doc.get("user_a_id"));
      const userBIds = videoMatches.map((doc) => doc.get("user_b_id"));
      const userIds = userAIds.concat(userBIds);
      console.log("sending texts to the following users: " + userIds);

      if (userIds.length === 0) {
        return;
      }
      const users = await txn.getAll(
        ...userIds.map((id) => admin.firestore().collection("users").doc(id))
      );

      const usersById = Object.assign(
        {},
        ...users.map((user) => ({ [user.id]: user.data() }))
      );

      const allPromises: Array<Promise<any>> = [];
      videoMatches.forEach((doc) => {
        const userA = usersById[doc.get("user_a_id")];
        const userB = usersById[doc.get("user_b_id")];
        const bodyA = `Hi ${
          userA.firstName
        }! You can join the video call in a few minutes at https://storydating.com/v/${doc.get(
          "videoId"
        )}/a. In case you need it, the passcode is ${doc.get(
          "videoPasscode"
        )}. Happy chatting!`;
        const bodyB = `Hi ${
          userB.firstName
        }! You can join the video call in a few minutes at https://storydating.com/v/${doc.get(
          "videoId"
        )}/b. In case you need it, the passcode is ${doc.get(
          "videoPasscode"
        )}. Happy chatting!`;
        allPromises.push(
          sendSms({ body: bodyA, from: TWILIO_NUMBER, to: userA.phone })
        );
        allPromises.push(
          sendSms({ body: bodyB, from: TWILIO_NUMBER, to: userB.phone })
        );
      });

      await Promise.all(allPromises);
      await Promise.all(
        videoMatches.map((doc) => txn.update(doc.ref, "called", true))
      );
    });
  });

export const issueCalls = functions.pubsub
  .schedule("0,30 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() >= 30) {
      createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("called", "==", false)
          .where("canceled", "==", false)
      );
      console.log(
        "found the following matches: " + matches.docs.map((doc) => doc.id)
      );

      const userAIds = matches.docs.map((doc) => doc.get("user_a_id"));
      const userBIds = matches.docs.map((doc) => doc.get("user_b_id"));
      const userIds = userAIds.concat(userBIds);
      console.log("issuing calls to the following users: " + userIds);

      await Promise.all(userIds.map((id) => callUserHelper(id)));
      await Promise.all(
        matches.docs.map((doc) => txn.update(doc.ref, "called", true))
      );
    });
  });

export const handleFlakes = functions.pubsub
  .schedule("10,40 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() >= 30) {
      createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("flakesHandled", "==", false)
          .where("canceled", "==", false)
      );
      console.log(
        "found the following matches: " + matches.docs.map((doc) => doc.id)
      );

      const flakeMatches = matches.docs
        .map((doc) => doc.data() as IMatch)
        .filter((m) => Object.keys(m.joined || {}).length !== 2);
      console.log(
        "found the following flaked matches: " + flakeMatches.map((m) => m.id)
      );

      const users = await new Firestore().getUsersForMatches(flakeMatches);
      const smsPromises: Array<Promise<any>> = [];
      flakeMatches.forEach((m) => {
        m.user_ids.forEach((userId) => {
          const user = users[userId];
          const other =
            userId === m.user_a_id ? users[m.user_b_id] : users[m.user_a_id];
          const body =
            userId in (m.joined || {})
              ? flakeApology(user, other)
              : flakeWarning(user, other);
          smsPromises.push(
            sendSms({
              body,
              from: TWILIO_NUMBER,
              to: user.phone,
            })
          );
        });
      });
      await Promise.all(smsPromises);
      await Promise.all(
        matches.docs.map((doc) => txn.update(doc.ref, "flakesHandled", true))
      );
    });
  });

export const markJoined = functions.https.onCall(async (request) => {
  const videoId = request.videoId;
  const user = request.user;

  const matches = await admin
    .firestore()
    .collection("matches")
    .where("videoId", "==", videoId)
    .get();
  if (matches.docs.length === 0) {
    console.warn(`unknown videoId: ${videoId}`);
    return;
  }
  if (user !== "a" && user !== "b") {
    console.warn(`unknown user: ${user} for videoId ${videoId}`);
    return;
  }
  const match = matches.docs[0];
  const userId = user === "a" ? match.get("user_a_id") : match.get("user_b_id");
  await match.ref.update("joined." + userId, true);
  return { redirect: match.get("videoLink") };
});

function connected(match: IMatch) {
  if (match.mode === "video") {
    return match.joined && Object.keys(match.joined).length === 2;
  }
  return match.twilioSid !== undefined;
}

export const revealRequest = functions.pubsub
  .schedule("20,50 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() > 30) {
      createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("revealRequested", "==", false)
      );
      const connectedMatches = matches.docs.filter((doc) => connected(doc.data() as IMatch));
      await Promise.all(
        connectedMatches.map(async (doc) => {
          await playCallOutro(doc.data() as IMatch, doc.get("twilioSid"));
          txn.update(doc.ref, "revealRequested", true);
        })
      );
    });
  });

export const revealRequestVideo = functions.pubsub
  .schedule("0 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    createdAt.subtract(1, "hour");
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("revealRequested", "==", false)
      );
      const videoMatches = matches.docs.filter(
        (doc) => doc.get("canceled") === false && doc.get("mode") === "video"
      );
      await Promise.all(
        videoMatches.map(async (doc) => {
          await callStudio(
            "reveal_request",
            doc.data() as IMatch,
            new Firestore(),
            true
          );
          txn.update(doc.ref, "revealRequested", true);
        })
      );
    });
  });

async function playCallOutro(match: IMatch, conferenceSid: string) {
  try {
    // wrap in try/catch as twilio will throw if the conference has already ended
    const participants = await client
      .conferences(conferenceSid)
      .participants.list();
    await Promise.all(
      participants.map((participant) =>
        client
          .conferences(conferenceSid)
          .participants(participant.callSid)
          .update({ muted: true })
      )
    );
    await client
      .conferences(conferenceSid)
      .update({ announceUrl: BASE_URL + "callOutro" });
    await util.promisify(setTimeout)(35_000);
    await client.conferences(conferenceSid).update({ status: "completed" });
  } catch (err) {
    console.log(err);
  }
  await callStudio("reveal_request", match, new Firestore(), false);
}

export const saveReveal = functions.https.onRequest(
  async (request, response) => {
    const res = await saveRevealHelper(request.body, new Firestore());
    if (res) {
      response.send(res);
    } else {
      response.end();
    }
  }
);

export const markActive = functions.https.onRequest(
  async (request, response) => {
    const phone = request.body.phone;
    const userQuery = await admin
      .firestore()
      .collection("users")
      .where("phone", "==", phone)
      .get();
    if (userQuery.empty) {
      console.error("No user with phone " + phone);
      response.end();
      return;
    }
    if (request.body.active) {
      await userQuery.docs[0].ref.update({ status: "resurrected" });
    } else {
      await userQuery.docs[0].ref.update({ status: "opt-out" });
    }
    response.end();
  }
);

async function callUserHelper(userId: string) {
  const user = await admin.firestore().collection("users").doc(userId).get();
  if (!user.exists) {
    console.error(
      "Could not make call for user that does not exist: " + userId
    );
  }

  await client.calls.create({
    url: BASE_URL + "screenCall",
    to: user.get("phone"),
    from: "+12036338466",
  });
}

export const callUser = functions.https.onRequest(async (request, response) => {
  await callUserHelper(request.body.userId);
  response.end();
});

export const screenCall = functions.https.onRequest(
  async (request, response) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const gather = twiml.gather({
      numDigits: 1,
      action: BASE_URL + "addUserToCall",
    });
    gather.play(
      "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_screen.mp3?alt=media"
    );

    // If the user doesn't enter input, loop
    twiml.redirect("/screenCall");

    response.set("Content-Type", "text/xml");
    response.send(twiml.toString());
  }
);

/** Called directly for incoming calls. Also called for outbound calls after the user has passed the call screen. */
export const addUserToCall = functions.https.onRequest(
  async (request, response) => {
    const callerPhone =
      request.body.Direction === "inbound"
        ? request.body.From
        : request.body.To;
    const twiml = await getConferenceTwimlForPhone(callerPhone);
    response.set("Content-Type", "text/xml");
    response.send(twiml.toString());
  }
);

export const conferenceStatusWebhook = functions.https.onRequest(
  async (request, response) => {
    if (request.body.StatusCallbackEvent === "participant-join") {
      const conferenceSid = request.body.ConferenceSid;
      const participants = await client
        .conferences(conferenceSid)
        .participants.list();
      if (participants.length === 1) {
        return;
      }
      await admin
        .firestore()
        .collection("matches")
        .doc(request.body.FriendlyName)
        .update({ ongoing: true, twilioSid: conferenceSid });
      await client
        .conferences(conferenceSid)
        .update({ announceUrl: BASE_URL + "announceUser" });
      await util.promisify(setTimeout)(28_000);
      await Promise.all(
        participants.map((participant) =>
          client
            .conferences(conferenceSid)
            .participants(participant.callSid)
            .update({ muted: false })
        )
      );
    } else if (request.body.StatusCallbackEvent === "conference-end") {
      await admin
        .firestore()
        .collection("matches")
        .doc(request.body.FriendlyName)
        .update({ ongoing: false });
    }
    response.end();
  }
);

export const announceUser = functions.https.onRequest((request, response) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.play(
    "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_intro_20min_video_beep.mp3?alt=media"
  );
  response.set("Content-Type", "text/xml");
  response.send(twiml.toString());
});

export const announce5Min = functions.https.onRequest((request, response) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.play(
    "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media"
  );
  response.set("Content-Type", "text/xml");
  response.send(twiml.toString());
});

export const announce1Min = functions.https.onRequest((request, response) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.play(
    "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media"
  );
  response.set("Content-Type", "text/xml");
  response.send(twiml.toString());
});

export const callOutro = functions.https.onRequest((request, response) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.play(
    "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_outro_video.mp3?alt=media"
  );
  response.set("Content-Type", "text/xml");
  response.send(twiml.toString());
});

export const call5MinWarning = functions.pubsub
  .schedule("15,45 * * * *")
  .onRun(async (context) => {
    await admin.firestore().runTransaction(async (txn) => {
      const ongoingCalls = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("ongoing", "==", true)
          .where("warned5Min", "==", false)
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) =>
          client
            .conferences(doc.get("twilioSid"))
            .update({ announceUrl: BASE_URL + "announce5Min" })
        )
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) => txn.update(doc.ref, "warned5Min", true))
      );
    });
  });

// runs every hour at 29 minutes past
export const call1MinWarning = functions.pubsub
  .schedule("19,49 * * * *")
  .onRun(async (context) => {
    // wait 30s
    await util.promisify(setTimeout)(30_000);
    await admin.firestore().runTransaction(async (txn) => {
      const ongoingCalls = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("ongoing", "==", true)
          .where("warned1Min", "==", false)
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) =>
          client
            .conferences(doc.get("twilioSid"))
            .update({ announceUrl: BASE_URL + "announce1Min" })
        )
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) => txn.update(doc.ref, "warned1Min", true))
      );
    });
  });

export const backupFirestore = functions.pubsub
  .schedule("every 24 hours")
  .onRun((context) => {
    const fClient = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const databaseName = fClient.databasePath(projectId, "(default)");

    const outputUriPrefix =
      "gs://" +
      admin.storage().bucket().name +
      "/backups/" +
      moment().format("YYYY-MM-DD");
    console.log("backing up to " + outputUriPrefix);
    return fClient.exportDocuments({
      name: databaseName,
      outputUriPrefix,
      collectionIds: [], // leave collectionIds empty to export all collections
    });
  });

export const notifyIncomingText = functions.https.onRequest(
  async (request, response) => {
    const phone = request.body.phone;
    if (phone === functions.config().twilio.notify_phone) {
      // special case grace's phone number...
      response.end();
    }
    const userQuery = await admin
      .firestore()
      .collection("users")
      .where("phone", "==", phone)
      .get();
    if (userQuery.empty) {
      console.error("No user with phone " + phone);
      response.end();
      return;
    }
    const user = userQuery.docs[0];
    const fullName = user.get("firstName") + " " + user.get("lastName");
    await client.conversations.conversations
      .get("CH3b12dac2b9484e5fb719bd2a32f16272")
      .messages.create({
        author: "+12036338466",
        body: `From: ${fullName}
Body: ${request.body.message}`,
      });
    response.end();
  }
);
