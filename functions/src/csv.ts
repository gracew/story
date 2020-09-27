import * as csv from "csv-parser";
import * as admin from "firebase-admin";
import * as fs from 'fs';
import * as moment from "moment-timezone";
import * as twilio from 'twilio';
import { TWILIO_NUMBER } from './twilio';
import { processTimeZone } from "./util";

export async function processBulkSmsCsv(tempFilePath: string, client: twilio.Twilio) {
    const promises: Promise<any>[] = []
    fs.createReadStream(tempFilePath)
        .pipe(csv(["phone", "body"]))
        .on('data', data => {
            promises.push(client.messages
                .create({
                    body: data.body,
                    from: TWILIO_NUMBER,
                    to: data.phone,
                }));

        });
    await Promise.all(promises);
}

export async function processMatchCsv(tempFilePath: string) {
    const promises: Promise<any>[] = []
    fs.createReadStream(tempFilePath)
        .pipe(csv(["userAId", "userBId", "date", "time", "timezone"]))
        .on("data", async data => {
            const userA = await admin.firestore().collection("users").doc(data.userAId).get();
            const userB = await admin.firestore().collection("users").doc(data.userBId).get();

            if (!userA.exists) {
                console.error("cannot find user with id " + data.userAId);
                return;
            }
            if (!userB.exists) {
                console.error("cannot find user with id " + data.userBId);
                return;
            }

            const timezone = processTimeZone(data.timezone.trim())
            const createdAt = moment.tz(data.date + " " + data.time, "MM-DD-YYYY hh:mm:ss a", timezone)
            const match = {
                user_a_id: data.userAId,
                user_b_id: data.userBId,
                user_ids: [data.userAId, data.userBId],
                created_at: createdAt
            }
            promises.push(admin.firestore().collection("matches").doc().set(match));
        });
    await Promise.all(promises);
}