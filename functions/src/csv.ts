import * as fs from 'fs';
import * as moment from "moment-timezone";
import * as neatCsv from 'neat-csv';
import { Firestore } from "./firestore";
import { client, TWILIO_NUMBER } from './twilio';

export async function processBulkSmsCsv(tempFilePath: string) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["phone", "body"] });
    return Promise.all(rows.map(async data => {
        return client.messages
            .create({
                body: data.body,
                from: TWILIO_NUMBER,
                to: data.phone,
            });
    }))
}

export async function processAvailabilityCsv(tempFilePath: string, firestore: Firestore) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["userId", "timezone"] });
    return Promise.all(rows.map(async data => {
        const user = await firestore.getUser(data.userId)
        if (!user) {
            console.error("cannot find user with id " + data.userId);
            return;
        }
        const body = `Hi ${user.firstName}. It's Voicebar. We've got a potential match for you! Are you available for a 30 minute phone call with your match at 8pm ${data.timezone} any day this week? Please respond with all the days you're free. You can also reply SKIP to skip this week. Respond in the next 3 hours to confirm your date.`;
        return client.messages
            .create({
                body,
                from: TWILIO_NUMBER,
                to: user.phone,
            });
    }));
}

export async function processMatchCsv(tempFilePath: string, firestore: Firestore) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["userAId", "userBId", "date", "time", "timezone"] })
    return Promise.all(rows.map(async data => {
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
        return firestore.createMatch({
            user_a_id: data.userAId,
            user_b_id: data.userBId,
            user_ids: [data.userAId, data.userBId],
            created_at: createdAt.toDate()
        });
    }));
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