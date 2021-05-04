import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import { parseTime } from "./times";

export const saveAvailability = functions.https.onRequest(async (req, response) => {
  const week = moment().startOf("week").format("YYYY-MM-DD")
  const userId = req.body.form_response.hidden.u;
  if (!userId) {
    console.error(new Error("missing userId"));
    response.end();
    return;
  }

  const update = parseAvailability(req.body.form_response.answers, moment);
  await admin.firestore().collection("scheduling").doc(week).collection("users").doc(userId).update(update);
  response.end();
});

export function parseAvailability(answers: any[], getTimestamp: () => moment.Moment) {
  const update: Record<string, any> = { "interactions.responded": true };
  answers.forEach((a: any) => {
    if (a.field.ref === "matches") {
      if (a.choice.label === "Skip this week") {
        update.skip = true;
        update.matches = 0;
        update.available = [];
      } else {
        update.skip = false;
        update.matches = parseInt(a.choice.label);
      }
    } else if (a.field.ref === "timesPT") {
      update.available = a.choices.labels
        .map((c: string) => parseTime(c, "America/Los_Angeles", getTimestamp)?.toDate())
        .filter((d: Date) => d);
    } else if (a.field.ref === "timesCT") {
      update.available = a.choices.labels
        .map((c: string) => parseTime(c, "America/Chicago", getTimestamp)?.toDate())
        .filter((d: Date) => d);
    } else if (a.field.ref === "timesET") {
      update.available = a.choices.labels
        .map((c: string) => parseTime(c, "America/New_York", getTimestamp)?.toDate())
        .filter((d: Date) => d);
    }
  })
  return update;
};
