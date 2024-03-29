import * as firestore from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import fetch from "node-fetch";
import * as os from "os";
import * as path from "path";
import {
  callUser,
  createMatch,
  createSmsChat,
  potentialMatches,
  remainingMatches
} from "./admin";
import {
  cancelMatch,
  getCommonAvailability,
  getPreferences,
  getPublicProfile,
  getUpcomingMatches,
  getVideoAvailability,
  onboardUser,
  rescheduleMatch,
  savePreferences,
  saveRating,
  saveReveal,
  saveVideoAvailability
} from "./app";
import {
  addUserToCall,
  call1MinWarning,
  call5MinWarning,
  conferenceStatusWebhook,
  handleFlakes,
  handleRevealNoReply,
  issueCalls,
  issueRecalls,
  markJoined,
  notifyIncomingTextHelper,
  notifyRevealJobs,
  revealRequest,
  revealRequestVideo,
  sendReminderTextsOneHour,
  sendReminderTextsTenMinutes,
  sendVideoLink,
  warnSmsChatExpiration
} from "./calls";
import {
  createMatches,
  createSchedulingRecords,
  processBulkSmsCsv,
  sendAvailabilityReminderCT,
  sendAvailabilityReminderET,
  sendAvailabilityReminderMT,
  sendAvailabilityReminderPT,
  sendAvailabilityTexts,
  sendMatchNotificationTexts
} from "./csv";
import { prompts } from "./smsCopy";
import { client, sendSms, validateRequest } from "./twilio";
import { saveAvailability } from "./typeform";

admin.initializeApp();

export {
  addUserToCall,
  call1MinWarning,
  call5MinWarning,
  callUser,
  cancelMatch,
  conferenceStatusWebhook,
  createMatch,
  createMatches,
  createSchedulingRecords,
  createSmsChat,
  potentialMatches,
  remainingMatches,
  handleFlakes,
  handleRevealNoReply,
  getCommonAvailability,
  getPreferences,
  getPublicProfile,
  getUpcomingMatches,
  getVideoAvailability,
  issueCalls,
  issueRecalls,
  markJoined,
  notifyRevealJobs,
  onboardUser,
  rescheduleMatch,
  revealRequest,
  revealRequestVideo,
  saveAvailability,
  savePreferences,
  saveRating,
  saveReveal,
  saveVideoAvailability,
  sendAvailabilityTexts,
  sendAvailabilityReminderET,
  sendAvailabilityReminderCT,
  sendAvailabilityReminderMT,
  sendAvailabilityReminderPT,
  sendMatchNotificationTexts,
  sendReminderTextsOneHour,
  sendReminderTextsTenMinutes,
  sendVideoLink,
  warnSmsChatExpiration,
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

export const markActive = functions.https.onRequest(
  async (request, response) => {
    validateRequest("markActive", request);
    const phone = request.body.phone;
    const userQuery = await admin
      .firestore()
      .collection("users")
      .where("phone", "==", phone)
      .get();
    if (userQuery.empty) {
      console.error(new Error("No user with phone " + phone));
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
    validateRequest("notifyIncomingText", request);
    const phone = request.body.phone;
    const message = await client.messages(request.body.message).fetch();
    await notifyIncomingTextHelper(phone, message.body);
    response.end();
  }
);

export const smsStatusCallback = functions.https.onRequest(
  async (request, response) => {
    validateRequest("smsStatusCallback", request);
    const status = request.body.MessageStatus;
    if (status !== "undelivered" && status !== "failed") {
      response.end();
      return;
    }

    const userQuery = await admin
      .firestore()
      .collection("users")
      .where("phone", "==", request.body.To)
      .get();
    const fullName = userQuery.empty
      ? "Unknown user"
      : userQuery.docs[0].get("firstName") +
        " " +
        userQuery.docs[0].get("lastName");
    const message = await client.messages(request.body.MessageSid).fetch();

    await fetch(functions.config().slack.webhook_url, {
      method: "post",
      body: JSON.stringify({
        text: `Status: ${status}
To: ${fullName}
Body: ${message.body}`,
      }),
      headers: { "Content-Type": "application/json" },
    });
    response.end();
  }
);

export const copyWeeklyTemplate = functions.pubsub
  .schedule("every sunday 1:00")
  .onRun(async (context) => {
    const week = moment().startOf("week").format("YYYY-MM-DD");
    const defaultTemplate = await admin
      .firestore()
      .collection("smsCopy")
      .doc("default")
      .get();
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    const data = {
      ...defaultTemplate.data(),
      reminder: [
        `Hi FIRST_NAME! Just a reminder that you'll be speaking with MATCH_NAME in an hour. Here's one idea to get the conversation started: "${prompt}"`,
      ],
      reminderNoPhoto: [
        "Hi FIRST_NAME! Just a reminder that you'll be speaking with MATCH_NAME in an hour. We'll swap photos after the call, so make sure to add yours at https://storydating.com/login",
        `Here's one idea to get the conversation started: "${prompt}"`,
      ],
    };
    await admin.firestore().collection("smsCopy").doc(week).set(data);
  });
