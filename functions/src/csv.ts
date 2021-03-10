import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as fs from 'fs';
import * as moment from "moment-timezone";
import * as neatCsv from 'neat-csv';
import * as os from "os";
import * as path from "path";
import { Firestore, IMatch, IUser } from "./firestore";
import { availability as availabilityCopy, matchNotification } from "./smsCopy";
import { sendSms, TWILIO_NUMBER } from './twilio';

export async function processBulkSmsCsv(tempFilePath: string, sendSmsFn: (opts: any) => Promise<any>) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["phone", "body"] });
    return Promise.all(rows.map(async data => {
        return sendSmsFn({
            body: data.body,
            from: TWILIO_NUMBER,
            to: data.phone,
        });
    }))
}

/**
 * Creates scheduling records for each row in a CSV. The CSV should have a single column, userId. There should not be a 
 * header line.
 */
export const createSchedulingRecords = functions.storage
    .object()
    .onFinalize(async (object) => {
        if (!(object.name && object.name.startsWith("availability"))) {
            return;
        }
        const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
        await admin
            .storage()
            .bucket(object.bucket)
            .file(object.name)
            .download({ destination: tempFilePath });
        const contents = fs.readFileSync(tempFilePath).toString();
        const rows = await neatCsv(contents, { headers: ["userId", "timezone"] });
        const userIds = rows.map(data => data.userId);
        const week = moment().startOf("week").format("YYYY-MM-DD");
        await new Firestore().createSchedulingRecords(week, userIds);
    });

export const sendAvailabilityTexts = functions.pubsub
    .schedule("every sunday 13:00")
    .onRun(async (context) => {
        const week = moment().startOf("week").format("YYYY-MM-DD");
        const availability = await admin.firestore()
            .collection("scheduling")
            .doc(week)
            .collection("users")
            .where("interactions.requested", "==", false)
            .get();
        const userRefs = availability.docs.map(doc => admin.firestore().collection("users").doc(doc.id));
        const users = await admin.firestore().getAll(...userRefs);
        const batch = admin.firestore().batch();
        availability.docs.forEach(doc => batch.update(doc.ref, { "interactions.requested": true }))
        await batch.commit();

        await Promise.all(users.map(async doc => {
            const user = doc.data() as IUser;
            return sendSms({
                body: await availabilityCopy(user),
                from: TWILIO_NUMBER,
                to: user.phone,
            });
        }));
    });

export const sendReminderTextsET = functions.pubsub
    .schedule("every sunday 17:00")
    .onRun(async () => {
        reminderHelper("ET")
    });

export const sendReminderTextsCT = functions.pubsub
    .schedule("every sunday 18:00")
    .onRun(async () => {
        reminderHelper("CT")
    });

export const sendReminderTextsPT = functions.pubsub
    .schedule("every sunday 20:00")
    .onRun(async () => {
        reminderHelper("PT")
    });

async function reminderHelper(timezone: string) {
    const week = moment().startOf("week").format("YYYY-MM-DD");
    const availability = await admin.firestore()
        .collection("scheduling")
        .doc(week)
        .collection("users")
        .where("interactions.responded", "==", true)
        .where("interactions.reminded", "==", false)
        .get();
    const userRefs = availability.docs.map(a => admin.firestore().collection("users").doc(a.id));
    const users = await admin.firestore().getAll(...userRefs);
    const usersTimezone = users.filter(u => u.get("timezone") === timezone);

    const batch = admin.firestore().batch();
    usersTimezone.forEach(u => {
        const availabilityRef = admin.firestore().collection("scheduling").doc(week).collection("users").doc(u.id);
        batch.update(availabilityRef, { "interactions.reminded": true });
    });
    await batch.commit();

    await Promise.all(usersTimezone.map(doc => {
        const user = doc.data() as IUser;
        sendSms({
            body: `Your match will expire soon! If you'd like to connect this week, fill out this super short form in the next hour to let us know your availability: https://storydating.com/weekly#u=${user.id}&tz=${user.timezone}"`,
            from: TWILIO_NUMBER,
            to: user.phone,
        })
    }));
}
export async function processMatchCsv(tempFilePath: string, firestore: Firestore, sendSmsFn: (opts: any) => Promise<any>) {
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = await neatCsv(contents, { headers: ["userAId", "userBId", "date", "time", "timezone"] })
    const matches = await Promise.all(rows.map(data => createMatchFirestore(data, firestore)));
    return sendMatchNotificationTexts(
        matches.filter(m => m !== undefined) as IMatch[],
        firestore,
        sendSmsFn);
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
        joined: {},
        created_at: new admin.firestore.Timestamp(createdAt.unix(), 0),
        canceled: data.canceled || false,
        interactions: {
            reminded: false,
            called: false,
            flakesHandled: false,
            warned5Min: false,
            warned1Min: false,
            revealRequested: false,
        },
        mode: data.mode || "phone",
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

async function sendMatchNotificationTexts(matches: IMatch[], firestore: Firestore, sendSmsFn: (opts: any) => Promise<any>) {
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
                await sendSmsFn({
                    body: t,
                    from: TWILIO_NUMBER,
                    to: usersById[userId].phone,
                });
            }
        })
    )
}
