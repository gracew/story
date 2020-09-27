import * as csv from "csv-parser";
import * as fs from 'fs';
import * as moment from "moment-timezone";
import { Firestore } from "./firestore";
import { client, TWILIO_NUMBER } from './twilio';

export function processBulkSmsCsv(tempFilePath: string) {
    fs.createReadStream(tempFilePath)
        .pipe(csv(["phone", "body"]))
        .on('data', data => {
            client.messages
                .create({
                    body: data.body,
                    from: TWILIO_NUMBER,
                    to: data.phone,
                });
        });
}

export function processMatchCsv(tempFilePath: string, firestore: Firestore) {
    fs.createReadStream(tempFilePath)
        .pipe(csv(["userAId", "userBId", "date", "time", "timezone"]))
        .on("data", async data => {
            const userA = await firestore.getUser(data.userAId);
            const userB = await firestore.getUser(data.userBId);

            if (!userA.exists) {
                console.error("cannot find user with id " + data.userAId);
                return;
            }
            if (!userB.exists) {
                console.error("cannot find user with id " + data.userBId);
                return;
            }

            const timezone = processTimeZone(data.timezone.trim())
            if (!timezone) {
                console.error("invalid timezone, skpping row: " + data)
                return;
            }
            const createdAt = moment.tz(data.date + " " + data.time, "MM-DD-YYYY hh:mm:ss a", timezone)
            await firestore.createMatch({
                user_a_id: data.userAId,
                user_b_id: data.userBId,
                user_ids: [data.userAId, data.userBId],
                created_at: createdAt.toDate()
            });
        });
}

function processTimeZone(tz: string) {
    if (tz === "PT") {
        return "America/Los_Angeles"
    } else if (tz === "CT") {
        return "America/Chicago"
    } else if (tz === "ET") {
        return "America/New_York"
    }
    return undefined;
}