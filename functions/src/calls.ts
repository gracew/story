import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import fetch from "node-fetch";
import * as util from "util";
import { Firestore, IMatch, IUser } from "./firestore";
import { chatExpiration, chatIntro, flakeApology, flakeWarning, reminder, videoLink, videoReminder } from "./smsCopy";
import {
  callStudio,
  client,
  getConferenceTwimlForPhone,
  saveRevealHelper,
  sendSms,
  TWILIO_NUMBER
} from "./twilio";

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
          .where("interactions.reminded", "==", false)
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
        matches.docs.map((doc) => txn.update(doc.ref, "interactions.reminded", true))
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
          .where("interactions.called", "==", false)
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
        const bodyA = videoLink(userA, doc);
        const bodyB = videoLink(userB, doc);
        allPromises.push(
          sendSms({ body: bodyA, from: TWILIO_NUMBER, to: userA.phone })
        );
        allPromises.push(
          sendSms({ body: bodyB, from: TWILIO_NUMBER, to: userB.phone })
        );
      });

      await Promise.all(allPromises);
      await Promise.all(
        videoMatches.map((doc) => txn.update(doc.ref, "interactions.called", true))
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
          .where("interactions.called", "==", false)
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
        matches.docs.map((doc) => txn.update(doc.ref, "interactions.called", true))
      );
    });
  });

export const issueRecalls = functions.pubsub
  .schedule("2,32 * * * *")
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
          .where("interactions.recalled", "==", false)
          .where("canceled", "==", false)
      );
      const matchesToRecall = matches.docs
        .map(doc => doc.data() as IMatch)
        .filter(m => m.mode === "phone" && m.twilioSid === undefined)
      console.log(
        "found the following matches: " + matchesToRecall.map(m => m.id)
      );

      const usersToRecall: string[] = [];
      matchesToRecall.forEach(m => {
        const joined = Object.keys(m.joined || {});
        if (!joined.includes(m.user_a_id)) {
          usersToRecall.push(m.user_a_id);
        }
        if (!joined.includes(m.user_b_id)) {
          usersToRecall.push(m.user_b_id);
        }
      })

      console.log("issuing calls to the following users: " + usersToRecall);

      await Promise.all(usersToRecall.map((id) => callUserHelper(id)));
      await Promise.all(
        matches.docs.map((doc) => txn.update(doc.ref, "interactions.recalled", true))
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
          .where("interactions.flakesHandled", "==", false)
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
        matches.docs.map((doc) => txn.update(doc.ref, "interactions.flakesHandled", true))
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
          .where("interactions.revealRequested", "==", false)
      );
      const connectedMatches = matches.docs.filter((doc) => doc.get("twilioSid") !== undefined);
      await Promise.all(
        connectedMatches.map(async (doc) => {
          await playCallOutro(doc.data() as IMatch, doc.get("twilioSid"));
          txn.update(doc.ref, "interactions.revealRequested", true);
        })
      );
    });
  });

export const revealRequestVideo = functions.pubsub
  .schedule("0 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    createdAt.subtract(1, "hour");
    const today = moment().tz("America/Los_Angeles").format("dddd");
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("interactions.revealRequested", "==", false)
      );
      const videoMatches = matches.docs.filter(
        (doc) => doc.get("canceled") === false && doc.get("mode") === "video" && Object.keys(doc.get("joined")).length === 2
      );
      await Promise.all(
        videoMatches.map(async (doc) => {
          await callStudio(
            "reveal_request",
            doc.data() as IMatch,
            new Firestore(),
            true,
            today
          );
          txn.update(doc.ref, "interactions.revealRequested", true);
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
      .update({ announceUrl: getOutroUrl(match), announceMethod: "GET" });
    await util.promisify(setTimeout)(31_000);
    await client.conferences(conferenceSid).update({ status: "completed" });
  } catch (err) {
    console.log(err);
  }
  const today = moment().tz("America/Los_Angeles").format("dddd");
  await callStudio("reveal_request", match, new Firestore(), false, today);
}

export const saveReveal = functions.https.onRequest(
  async (request, response) => {
    const today = moment().tz("America/Los_Angeles").format("dddd");
    const res = await saveRevealHelper(request.body, new Firestore(), today);
    if (res) {
      response.send(res);
    } else {
      await notifyIncomingTextHelper(request.body.phone, request.body.reveal);
      response.end();
    }
  }
);

async function callUserHelper(userId: string) {
  const user = await admin.firestore().collection("users").doc(userId).get();
  if (!user.exists) {
    console.error(
      new Error("Could not make call for user that does not exist: " + userId)
    );
    return;
  }

  const match = await new Firestore().currentMatchForUser(userId);
  if (!match) {
    console.error(
      new Error("No scheduled match for user: " + userId)
    );
    return;
  }

  await client.calls.create({
    url: getScreenUrl(match),
    method: "GET",
    to: user.get("phone"),
    from: "+12036338466",
  });
}

export const callUser = functions.https.onRequest(async (request, response) => {
  await callUserHelper(request.body.userId);
  response.end();
});

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
      const matchDoc = await admin
        .firestore()
        .collection("matches")
        .doc(request.body.FriendlyName)
        .get();
      const match = matchDoc.data() as IMatch;
      if (participants.length === 1) {
        if (match.ongoing === false) {
          // one of the following could have happened:
          // 1. the current user previously joined and left the conference, is now rejoining
          // 2. the other user previously joined and left the conference
          // 3. both users were previously in the conference and have now left (e.g. due to connection issues)
          const userId = participants[0].label;
          const otherId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
          console.log("issuing call to user: " + otherId);
          await callUserHelper(otherId);
        }
        response.end();
        return;
      }

      // both participants have joined, save off the conferenceSid and play intro message
      await matchDoc.ref.update({ twilioSid: conferenceSid });
      await client
        .conferences(conferenceSid)
        .update({ announceUrl: getIntroUrl(match), announceMethod: "GET" });
      await util.promisify(setTimeout)(26_000);
      await Promise.all(
        participants.map((participant) =>
          client
            .conferences(conferenceSid)
            .participants(participant.callSid)
            .update({ muted: false })
        )
      );
    } else if (request.body.StatusCallbackEvent === "conference-end") {
      // the last participant has left the conference
      await admin
        .firestore()
        .collection("matches")
        .doc(request.body.FriendlyName)
        .update({ ongoing: false });
    }
    response.end();
  }
);

function getScreenUrl(match: IMatch) {
  return match.recordingOverride
    ? "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2FscreenCall2.xml?alt=media"
    : "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2FscreenCall.xml?alt=media";
}

function getIntroUrl(match: IMatch) {
  return match.recordingOverride
    ? "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_intro_20min_video_beep.mp3?alt=media"
    : "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_intro_20min_text_beep_grace.mp3?alt=media";
}

function getOutroUrl(match: IMatch) {
  return match.recordingOverride
    ? "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_outro_video.mp3?alt=media"
    : "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_outro_video_grace.mp3?alt=media";
}

export const call5MinWarning = functions.pubsub
  .schedule("15,45 * * * *")
  .onRun(async (context) => {
    await admin.firestore().runTransaction(async (txn) => {
      const ongoingCalls = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("ongoing", "==", true)
          .where("interactions.warned5Min", "==", false)
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) =>
          client
            .conferences(doc.get("twilioSid"))
            .update({
              announceUrl: "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media",
              announceMethod: "GET",
            })
        )
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) => txn.update(doc.ref, "interactions.warned5Min", true))
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
          .where("interactions.warned1Min", "==", false)
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) =>
          client
            .conferences(doc.get("twilioSid"))
            .update({
              announceUrl: "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media",
              announceMethod: "GET",
            })
        )
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) => txn.update(doc.ref, "interactions.warned1Min", true))
      );
    });
  });

export const createSmsChat = functions.https.onRequest(async (request, response) => {
  const firestore = new Firestore();
  const match = await firestore.getMatch(request.body.matchId);
  if (!match) {
    response.end();
    return;
  }

  const usersById = await firestore.getUsersForMatches([match]);
  const userA = usersById[match.user_a_id];
  const userB = usersById[match.user_b_id];

  const session = await client.proxy
    .services("KS58cecadd35af39c56a4cae81837a89f3")
    .sessions
    .create({ uniqueName: request.body.matchId });
  const participants =
    client.proxy
      .services("KS58cecadd35af39c56a4cae81837a89f3")
      .sessions(session.sid)
      .participants;
  const [participantA, participantB] = await Promise.all([
    participants.create({ friendlyName: match.user_a_id, identifier: userA.phone }),
    participants.create({ friendlyName: match.user_b_id, identifier: userB.phone }),
  ]);
  await Promise.all([
    participants(participantA.sid).messageInteractions.create({ body: chatIntro(userA, userB) }),
    participants(participantB.sid).messageInteractions.create({ body: chatIntro(userB, userA) })
  ])
  response.end();
});

export const warnSmsChatExpiration = functions.https.onRequest(async (request, response) => {
  const participants = await client.proxy
    .services("KS58cecadd35af39c56a4cae81837a89f3")
    .sessions(request.body.sessionSid)
    .participants
    .list();
  await Promise.all(participants.map(p =>
    client.proxy
      .services("KS58cecadd35af39c56a4cae81837a89f3")
      .sessions(request.body.sessionSid)
      .participants(p.sid)
      .messageInteractions.create({ body: chatExpiration })
  ));
  response.end();
});

export async function notifyIncomingTextHelper(phone: string, message: string) {
  const userQuery = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", phone)
    .get();
<<<<<<< HEAD
  const fullName = userQuery.empty ? "Unknown user" : userQuery.docs[0].get("firstName") + " " + userQuery.docs[0].get("lastName");
  return fetch(functions.config().slack.webhook_url, {
    method: "post",
    body: JSON.stringify({
      text: `From: ${fullName}
Body: ${message}`
    }),
    headers: { "Content-Type": "application/json" },
  });
=======
  if (userQuery.empty) {
    console.error("No user with phone " + phone);
    return;
  }
  const user = userQuery.docs[0];
  const fullName = user.get("firstName") + " " + user.get("lastName");
  await client.conversations.conversations
    .get("CH3b12dac2b9484e5fb719bd2a32f16272")
    .messages.create({
      author: "+12036338466",
      body: `From: ${fullName}
Body: ${message}`,
    });
  return user.data() as IUser;
>>>>>>> automatic recall after 2 min + call forwarding
}