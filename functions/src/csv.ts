import * as csv from "csv-parser";
import * as fs from 'fs';
import * as moment from "moment-timezone";
import { Firestore } from "./firestore";
import { client, TWILIO_NUMBER } from './twilio';

export function processBulkSmsCsv(tempFilePath: string) {
    fs.createReadStream(tempFilePath)
        .pipe(csv(["phone", "body"]))
        .on('data', async data => {
            await client.messages
                .create({
                    body: data.body,
                    from: TWILIO_NUMBER,
                    to: data.phone,
                });
        });
}

export function processAvailabilityCsv(tempFilePath: string, firestore: Firestore) {
    fs.createReadStream(tempFilePath)
        .pipe(csv(["userId", "timezone"]))
        .on('data', async data => {
            const user = await firestore.getUser(data.userId);
            if (!user) {
                console.error("cannot find user with id " + data.userId);
                return;
            }

            const body = `Hi ${user.firstName}. It's Voicebar. We've got a potential match for you! Are you available for a 30 minute phone call with your match at 8pm ${data.timezone} any day this week? Please respond with all the days you're free. You can also reply SKIP to skip this week. Respond in the next 3 hours to confirm your date.`;
            await client.messages
                .create({
                    body,
                    from: TWILIO_NUMBER,
                    to: user.phone,
                });
        });
}

export function processMatchCsv(tempFilePath: string, firestore: Firestore) {
    fs.createReadStream(tempFilePath)
        .pipe(csv(["userAId", "userBId", "date", "time", "timezone"]))
        .on("data", async data => {
            const userA = await firestore.getUser(data.userAId);
            const userB = await firestore.getUser(data.userBId);

            if (!userA) {
                console.error("cannot find user with id " + data.userAId);
                return;
            }
            if (!userB) {
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