import * as fs from 'fs';
import * as moment from "moment-timezone";
import { Firestore, IMatch } from "./firestore";
import { availability, matchNotification } from "./smsCopy";
import * as neatCsv from 'neat-csv';
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
        return client.messages
            .create({
                body: availability(user, data.timezone),
                from: TWILIO_NUMBER,
                to: user.phone,
            });
    }));
}

export async function processMatchCsv(tempFilePath: string, firestore: Firestore) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["userAId", "userBId", "date", "time", "timezone"] })
    await Promise.all(rows.map(async data => {
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
    }));
    return sendMatchNotificationTexts(firestore);
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

async function sendMatchNotificationTexts(firestore: Firestore) {
    const matches = await firestore.matchesThisWeek();

    // create map from userId to matches
    const userToMatches: Record<string, IMatch[]> = {};
    matches.forEach(m => {
        if (!(m.user_a_id in userToMatches)) {
            userToMatches[m.user_a_id] = [];
        }
        userToMatches[m.user_a_id].push(m)

        if (!(m.user_b_id in userToMatches)) {
            userToMatches[m.user_b_id] = [];
        }
        userToMatches[m.user_b_id].push(m)
    });

    const usersById = await firestore.getUsersForMatches(matches);
    // notify each user
    await Promise.all(
        Object.keys(userToMatches).map(async userId => {
            const texts = matchNotification(userId, userToMatches[userId], usersById)
            // send these linearly
            for (const t of texts) {
                await client.messages
                    .create({
                        body: t,
                        from: TWILIO_NUMBER,
                        to: usersById[userId].phone,
                    });
            }
        })
    )
}
