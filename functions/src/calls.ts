import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { isEmpty } from "lodash";
import * as moment from "moment-timezone";
import fetch from "node-fetch";
import * as util from "util";
import { Firestore, IMatch, IUser, NotifyRevealJob } from "./firestore";
import {
  chatExpiration,
  flakeApology,
  flakeWarning,
  phoneReminderOneHour,
  phoneReminderTenMinutes,
  revealNoReply,
  videoLink,
  videoReminderOneHour
} from "./smsCopy";
import {
  callStudio,
  client,
  getConferenceTwimlForPhone,
  nextMatchNameAndDate,
  POST_CALL_FLOW_ID,
  saveRevealHelper,
  sendSms,
  TWILIO_NUMBER
} from "./twilio";

/**
 * Sends reminder texts to either phone or video matches happening in the next hour (phone or video matches only happen
 * at :00 or :30)
 *
 * Sets the "interactions.reminded" flag on the match when succeeded.
 */
export const sendReminderTextsOneHour = functions.pubsub
  .schedule("0,30 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour").add(1, "hour");
    if (moment().minutes() >= 30) {
      createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async (txn) => {
      const matchSnaps = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("interactions.reminded", "==", false)
          .where("canceled", "==", false)
      );
      console.log(
        "found the following matches: " + matchSnaps.docs.map((doc) => doc.id)
      );

      const matches = matchSnaps.docs.map((m) => m.data() as IMatch);
      const usersById = await Firestore.getUsersForMatchesInTxn(txn, matches);
      console.log(
        "sending texts to the following users: " + Object.keys(usersById)
      );

      if (isEmpty(usersById)) {
        return;
      }

      const sendReminderPromises: Array<Promise<any>> = [];
      matches.forEach((match) => {
        const userA = usersById[match.user_a_id];
        const userB = usersById[match.user_b_id];
        const genCopy =
          match.mode === "video"
            ? promisify(videoReminderOneHour)
            : phoneReminderOneHour;
        sendReminderPromises.push(sendReminderTextPairs(userA, userB, genCopy));
      });

      await Promise.all(sendReminderPromises);
      await Promise.all(
        matchSnaps.docs.map((doc) =>
          txn.update(doc.ref, "interactions.reminded", true)
        )
      );
    });
  });

/**
 * Sends reminder texts ONLY to phone matches happening in the next 10 minutes (phone or video matches only happen
 * at :00 or :30). For video matches, we already send the video link close to the time of the call, so we don't need
 * to send yet another reminder for those.
 *
 * Sets the "interactions.remindedClose" flag on the match when succeeded.
 */
export const sendReminderTextsTenMinutes = functions.pubsub
  .schedule("50,20 * * * *")
  .onRun(async (context) => {
    let createdAt: moment.Moment;

    const currentTime = moment().utc();
    // case 1, xx:50 minutes where call starts in 10 minutes:
    if (currentTime.minutes() >= 50) {
      createdAt = currentTime.startOf("hour").add(1, "hour");
      // case 2, xx:20 minutes where call starts in 10 minutes:
    } else {
      createdAt = moment().utc().startOf("hour").add(30, "minutes");
    }

    await admin.firestore().runTransaction(async (txn) => {
      const matchSnaps = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("mode", "==", "phone")
          // TODO: after 5/31/2021, we can include this in the query and remove the in-code check for this field
          // .where("interactions.remindedClose", "==", false)
          .where("canceled", "==", false)
      );
      console.log(
        "found the following matches: " + matchSnaps.docs.map((doc) => doc.id)
      );

      const matches = matchSnaps.docs
        .map((m) => m.data() as IMatch)
        // TODO: remove this in-code check along with the query check we're removing after 5/31/2021
        .filter((match) => !match.interactions?.remindedClose);
      const usersById = await Firestore.getUsersForMatchesInTxn(txn, matches);
      console.log(
        "sending texts to the following users: " + Object.keys(usersById)
      );

      if (isEmpty(usersById)) {
        return;
      }

      const sendReminderPromises: Array<Promise<any>> = [];
      matches.forEach((match) => {
        const userA = usersById[match.user_a_id];
        const userB = usersById[match.user_b_id];
        sendReminderPromises.push(
          sendReminderTextPairs(userA, userB, phoneReminderTenMinutes)
        );
      });

      await Promise.all(sendReminderPromises);
      await Promise.all(
        matchSnaps.docs.map((doc) =>
          txn.update(doc.ref, "interactions.remindedClose", true)
        )
      );
    });
  });

async function sendReminderTextPairs(
  userA: IUser,
  userB: IUser,
  genCopy: (userA: IUser, userB: IUser) => Promise<string>
) {
  const sendFirstSms = sendSms({
    body: await genCopy(userA, userB),
    to: userA.phone,
  });
  const sendSecondSms = sendSms({
    body: await genCopy(userB, userA),
    to: userB.phone,
  });
  return Promise.all([sendFirstSms, sendSecondSms]);
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
      const videoMatches = matches.docs
        .filter((doc) => doc.get("mode") === "video")
        .map((doc) => doc.data() as IMatch);
      console.log(
        "found the following matches: " + videoMatches.map((m) => m.id)
      );

      const userAIds = videoMatches.map((m) => m.user_a_id);
      const userBIds = videoMatches.map((m) => m.user_b_id);
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
      videoMatches.forEach((m) => {
        const userA = usersById[m.user_a_id];
        const userB = usersById[m.user_b_id];
        const bodyA = videoLink(userA, m);
        const bodyB = videoLink(userB, m);
        allPromises.push(sendSms({ body: bodyA, to: userA.phone }));
        allPromises.push(sendSms({ body: bodyB, to: userB.phone }));
      });

      await Promise.all(allPromises);
      await Promise.all(
        videoMatches.map((m) =>
          txn.update(
            admin.firestore().collection("matches").doc(m.id),
            "interactions.called",
            true
          )
        )
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
        matches.docs.map((doc) =>
          txn.update(doc.ref, "interactions.called", true)
        )
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
        .map((doc) => doc.data() as IMatch)
        .filter((m) => m.mode === "phone" && m.twilioSid === undefined);
      console.log(
        "found the following matches: " + matchesToRecall.map((m) => m.id)
      );

      const usersToRecall: string[] = [];
      matchesToRecall.forEach((m) => {
        const joined = Object.keys(m.joined || {});
        if (!joined.includes(m.user_a_id)) {
          usersToRecall.push(m.user_a_id);
        }
        if (!joined.includes(m.user_b_id)) {
          usersToRecall.push(m.user_b_id);
        }
      });

      console.log("issuing calls to the following users: " + usersToRecall);

      await Promise.all(usersToRecall.map((id) => callUserHelper(id)));
      await Promise.all(
        matches.docs.map((doc) =>
          txn.update(doc.ref, "interactions.recalled", true)
        )
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
              to: user.phone,
            })
          );
        });
      });
      await Promise.all(smsPromises);
      await Promise.all(
        matches.docs.map((doc) =>
          txn.update(doc.ref, "interactions.flakesHandled", true)
        )
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
      const connectedMatches = matches.docs.filter(
        (doc) => doc.get("twilioSid") !== undefined
      );
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
        (doc) =>
          doc.get("canceled") === false &&
          doc.get("mode") === "video" &&
          Object.keys(doc.get("joined")).length === 2
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

/* Runs 15 minutes after the call ends to check for matches where oen or both users didn't reply. */
export const handleRevealNoReply = functions.pubsub
  .schedule("5,35 * * * *")
  .onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() < 30) {
      createdAt.subtract(30, "minutes");
    }
    await admin.firestore().runTransaction(async (txn) => {
      const matchRes = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("created_at", "==", createdAt)
          .where("interactions.revealRequested", "==", true)
      );
      const incompleteMatches = matchRes.docs
        .map((doc) => doc.data() as IMatch)
        .filter((m) => Object.keys(m.revealed).length < 2);

      // ok for this call to happen outside of the txn since we're not modifying the user objects
      const firestore = new Firestore();
      const usersById = await firestore.getUsersForMatches(incompleteMatches);

      return Promise.all(
        incompleteMatches.map(async (m) => {
          const userA = usersById[m.user_a_id];
          const userB = usersById[m.user_b_id];
          if (m.revealed[m.user_a_id] === undefined) {
            await Promise.all([
              saveRevealHelper(userA, m, false, firestore, txn),
              sendSms({ body: revealNoReply(userA, userB), to: userA.phone }),
            ]);
          }
          if (m.revealed[m.user_b_id] === undefined) {
            await Promise.all([
              saveRevealHelper(userB, m, false, firestore, txn),
              sendSms({ body: revealNoReply(userB, userA), to: userB.phone }),
            ]);
          }
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

export const notifyRevealJobs = functions.firestore
  .document("notifyRevealJobs/{docId}")
  .onCreate(async (change, context) => {
    // firestore triggers have at-least-once delivery semantics, so first check if we have already processed the event
    const eventRef = admin
      .firestore()
      .collection("firestoreEvents")
      .doc(context.eventId);
    const eventDoc = await eventRef.get();
    if (eventDoc.exists) {
      return;
    }
    await eventRef.create({});

    const job = change.data() as NotifyRevealJob;
    const firestore = new Firestore();
    const match = await firestore.getMatch(job.matchId);
    if (!match) {
      console.warn(`no match found for notify reveal job ${change.id}`);
      return;
    }
    const users = await firestore.getUsersForMatches([match]);
    const notifyUser = users[job.notifyUserId];
    const revealingUserId =
      match.user_a_id === job.notifyUserId ? match.user_b_id : match.user_a_id;
    const revealingUser = users[revealingUserId];
    const nextMatch = await firestore.nextMatchForUser(notifyUser.id);
    const nextMatchMeta = await nextMatchNameAndDate(
      notifyUser.id,
      firestore,
      nextMatch
    );

    await client.studio.flows(POST_CALL_FLOW_ID).executions.create({
      to: notifyUser.phone,
      from: TWILIO_NUMBER,
      parameters: {
        mode: job.mode,
        matchId: match.id,
        userId: notifyUser.id,
        firstName: notifyUser.firstName,
        matchUserId: revealingUser.id,
        matchName: revealingUser.firstName,
        matchPhone: revealingUser.phone,
        ...nextMatchMeta,
        video: match.mode === "video",
      },
    });
  });

export async function callUserHelper(userId: string) {
  const user = await admin.firestore().collection("users").doc(userId).get();
  if (!user.exists) {
    console.error(
      new Error("Could not make call for user that does not exist: " + userId)
    );
    return;
  }

  const match = await new Firestore().currentMatchForUser(userId);
  if (!match) {
    console.error(new Error("No scheduled match for user: " + userId));
    return;
  }

  await client.calls.create({
    url: getScreenUrl(match),
    method: "GET",
    to: user.get("phone"),
    from: "+12036338466",
  });
}

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
          const otherId =
            match.user_a_id === userId ? match.user_b_id : match.user_a_id;
          console.log("issuing call to user: " + otherId);
          await Promise.all([
            callUserHelper(otherId),
            matchDoc.ref.update({ ongoing: true }),
          ]);
        }
        response.end();
        return;
      }

      // both participants have joined, save off the conferenceSid and play intro message
      await matchDoc.ref.update({ ongoing: true, twilioSid: conferenceSid });
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
          client.conferences(doc.get("twilioSid")).update({
            announceUrl:
              "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media",
            announceMethod: "GET",
          })
        )
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) =>
          txn.update(doc.ref, "interactions.warned5Min", true)
        )
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
          client.conferences(doc.get("twilioSid")).update({
            announceUrl:
              "https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media",
            announceMethod: "GET",
          })
        )
      );
      await Promise.all(
        ongoingCalls.docs.map((doc) =>
          txn.update(doc.ref, "interactions.warned1Min", true)
        )
      );
    });
  });

/* Checks for SMS chats eligible for expiration at 1pm Pacific every day. */
export const warnSmsChatExpiration = functions.pubsub
  .schedule("0 13 * * *")
  .onRun(async (context) => {
    const oneWeekAgo = moment().subtract(1, "week").toDate();
    await admin.firestore().runTransaction(async (txn) => {
      const matches = await txn.get(
        admin
          .firestore()
          .collection("matches")
          .where("twilioChatCreatedAt", "<=", oneWeekAgo)
      );
      matches.docs.forEach(async (matchDoc) => {
        const match = matchDoc.data() as IMatch;
        if (
          match.interactions.warnedSmsChatExpiration ||
          !match.twilioChatSid
        ) {
          return;
        }
        client.proxy
          .services("KS58cecadd35af39c56a4cae81837a89f3")
          .sessions(match.twilioChatSid)
          .participants.each((p) =>
            p.messageInteractions().create({ body: chatExpiration })
          );
        txn.update(matchDoc.ref, "interactions.warnedSmsChatExpiration", true);
      });
    });
  });

/* Expires eligible SMS chats at midnight Pacific every day. */
export const expireSmsChat = functions.pubsub
  .schedule("0 0 * * *")
  .onRun(async (context) => {
    const matches = await admin
      .firestore()
      .collection("matches")
      .where("interactions.warnedSmsChatExpiration", "==", true)
      .get();
    matches.docs.forEach(async (matchDoc) => {
      const match = matchDoc.data() as IMatch;
      if (!match.twilioChatSid) {
        return;
      }
      const session = await client.proxy
        .services("KS58cecadd35af39c56a4cae81837a89f3")
        .sessions(match.twilioChatSid)
        .fetch();
      if (session.status === "open") {
        await session.update({ status: "closed" });
      }
    });
  });

export async function notifyIncomingTextHelper(phone: string, message: string) {
  const userQuery = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", phone)
    .get();
  const fullName = userQuery.empty
    ? "Unknown user"
    : userQuery.docs[0].get("firstName") +
      " " +
      userQuery.docs[0].get("lastName");
  return fetch(functions.config().slack.webhook_url, {
    method: "post",
    body: JSON.stringify({
      text: `From: ${fullName}
Body: ${message}`,
    }),
    headers: { "Content-Type": "application/json" },
  });
}

function promisify<I, A extends Array<I>, R>(
  f: (...args: A) => R
): (...args: A) => Promise<R> {
  return (...args: A) => Promise.resolve(f(...args));
}
