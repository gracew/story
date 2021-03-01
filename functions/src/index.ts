import * as firestore from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import * as os from "os";
import * as path from "path";
import { getPreferences, getPublicProfile, getUserByUsername, savePreferences } from "./app";
import { addUserToCall, announce1Min, announce5Min, announceUser, call1MinWarning, call5MinWarning, callOutro, callUser, conferenceStatusWebhook, createSmsChat, handleFlakes, issueCalls, markJoined, notifyIncomingTextHelper, revealRequest, revealRequestVideo, saveReveal, screenCall, sendReminderTexts, sendVideoLink } from "./calls";
import { createSchedulingRecords, processBulkSmsCsv, processMatchCsv, sendAvailabilityTexts, sendWaitlistTexts } from "./csv";
import { Firestore, IUser } from "./firestore";
import { registerUser } from "./register";
import { analyzeCollection, cancelMatch, createMatch } from "./retool";
import { bipartiteMatches, potentialMatches, remainingMatches } from "./scheduling";
import { client, sendSms, TWILIO_NUMBER } from "./twilio";

admin.initializeApp();

export {
  addUserToCall,
  analyzeCollection,
  announce1Min,
  announce5Min,
  announceUser,
  bipartiteMatches,
  call1MinWarning,
  call5MinWarning,
  callOutro,
  callUser,
  cancelMatch,
  conferenceStatusWebhook,
  createMatch,
  createSchedulingRecords,
  createSmsChat,
  potentialMatches,
  remainingMatches,
  handleFlakes,
  getPreferences,
  getPublicProfile,
  getUserByUsername,
  issueCalls,
  markJoined,
  registerUser,
  revealRequest,
  revealRequestVideo,
  savePreferences,
  saveReveal,
  screenCall,
  sendAvailabilityTexts,
  sendReminderTexts,
  sendWaitlistTexts,
  sendVideoLink,
};

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
    const user = await notifyIncomingTextHelper(phone, request.body.message)
    await recordAvailability(request.body.message.toLowerCase(), user);
    response.end();
  }
);

async function recordAvailability(messageLowercase: string, user?: IUser) {
  if (!user) {
    return;
  }

  const week = moment().startOf("week").format("YYYY-MM-DD");
  const today = moment().tz("America/Los_Angeles").format("YYYY-MM-DD");
  if (week !== today) {
    return;
  }

  const record = await admin.firestore().collection("scheduling").doc(week).collection("users").doc(user.id).get();
  if (record.get("interactions.acknowledged")) {
    // we already acknowledged the user's response once
    return;
  }

  const skip = messageLowercase.includes("skip");
  const tue = messageLowercase.includes("tue");
  const wed = messageLowercase.includes("wed");
  const thu = messageLowercase.includes("thu");
  const any = messageLowercase.includes("any");
  const all = messageLowercase.includes("all");
  const update = {
    tue: tue || any || all,
    wed: wed || any || all,
    thu: thu || any || all,
    skip,
    "interactions.acknowledged": true,
  }
  await admin.firestore().collection("scheduling").doc(week).collection("users").doc(user.id).update(update);

  if (skip) {
    await client.messages.create({
      body: "Sorry the timing didn't work out this week! We'll follow up next week with a new match for you.",
      from: TWILIO_NUMBER,
      to: user.phone,
    });
  } else if (update.tue || update.wed || update.thu) {
    await client.messages.create({
      body: `Thanks ${user.firstName}! We're working on finalizing your match and will send more details tomorrow.`,
      from: TWILIO_NUMBER,
      to: user.phone,
    });
  }
}

export const notifyNewRecording = functions.firestore
  .document('vday/{docId}')
  .onCreate((snap, context) =>
    client.conversations.conversations
      .get("CH3b12dac2b9484e5fb719bd2a32f16272")
      .messages.create({
        author: "+12036338466",
        body: "new recording submitted"
      })
  );