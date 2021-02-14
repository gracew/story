import * as firestore from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import * as os from "os";
import * as path from "path";
import { getPreferences, getUserByUsername, savePreferences } from "./app";
import { addUserToCall, announce1Min, announce5Min, announceUser, call1MinWarning, call5MinWarning, callOutro, callUser, conferenceStatusWebhook, handleFlakes, issueCalls, markJoined, notifyIncomingTextHelper, revealRequest, revealRequestVideo, saveReveal, screenCall, sendReminderTexts, sendVideoLink } from "./calls";
import { createSchedulingRecords, processBulkSmsCsv, processMatchCsv, sendAvailabilityTexts, sendWaitlistTexts } from "./csv";
import { Firestore } from "./firestore";
import { registerUser } from "./register";
import { analyzeCollection, cancelMatch, createMatch } from "./retool";
import { bipartiteMatches, potentialMatches, remainingMatches } from "./scheduling";
import { client, sendSms } from "./twilio";

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
  potentialMatches,
  remainingMatches,
  handleFlakes,
  getPreferences,
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
    if (phone === functions.config().twilio.notify_phone) {
      // special case grace's phone number...
      response.end();
    }
    await notifyIncomingTextHelper(phone, request.body.message)
    response.end();
  }
);

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