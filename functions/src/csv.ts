import * as fs from 'fs';
import * as moment from "moment-timezone";
import { Firestore, IMatch } from "./firestore";
import { availability, matchNotification } from "./smsCopy";
import * as neatCsv from 'neat-csv';
import { TWILIO_NUMBER } from './twilio';
import admin = require('firebase-admin');

export async function processBulkSmsCsv(tempFilePath: string, sendSms: (opts: any) => Promise<any>) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["phone", "body"] });
    return Promise.all(rows.map(async data => {
        return sendSms({
            body: data.body,
            from: TWILIO_NUMBER,
            to: data.phone,
        });
    }))
}

export async function processAvailabilityCsv(tempFilePath: string, firestore: Firestore, sendSms: (opts: any) => Promise<any>) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["userId", "timezone"] });
    return Promise.all(rows.map(async data => {
        const user = await firestore.getUser(data.userId)
        if (!user) {
            console.error("cannot find user with id " + data.userId);
            return;
        }
        return sendSms({
            body: availability(user, data.timezone),
            from: TWILIO_NUMBER,
            to: user.phone,
        });
    }));
}

export async function processMatchCsv(tempFilePath: string, firestore: Firestore, sendSms: (opts: any) => Promise<any>) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["userAId", "userBId", "date", "time", "timezone"] })
    const matches = await Promise.all(rows.map(data => createMatchFirestore(data, firestore)));
    return sendMatchNotificationTexts(
        matches.filter(m => m !== undefined) as IMatch[],
        firestore,
        sendSms);
}

export async function createMatchFirestore(data: any, firestore: Firestore) {
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
    const match = {
        user_a_id: data.userAId,
        user_b_id: data.userBId,
        user_ids: [data.userAId, data.userBId],
        created_at: new admin.firestore.Timestamp(createdAt.unix(), 0),
        canceled: data.canceled || false,
        reminded: false,
        called: false,
        joined: {},
        warned5Min: false,
        warned1Min: false,
        revealRequested: false,
    };
    await firestore.createMatch(match);
    return match;
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

async function sendMatchNotificationTexts(matches: IMatch[], firestore: Firestore, sendSms: (opts: any) => Promise<any>) {
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
                await sendSms({
                    body: t,
                    from: TWILIO_NUMBER,
                    to: usersById[userId].phone,
                });
            }
        })
    )
}
