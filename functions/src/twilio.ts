import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { QueryDocumentSnapshot } from "firebase-functions/lib/providers/firestore";
import * as twilio from "twilio";
import moment = require("moment");

export const TWILIO_NUMBER = '+12036338466';
export const BASE_URL = 'https://us-central1-speakeasy-prod.cloudfunctions.net/';
const accountSid = 'AC07d4a9a61ac7c91f7e5cecf1e27c45a6';
const authToken = functions.config().twilio.auth_token;
export const client = twilio(accountSid, authToken);


export async function getConferenceTwimlForPhone(phone: string) {
    const users = admin.firestore().collection("users");
    const result = await users.where("phone", "==", phone).get();
    const errorResponse = new twilio.twiml.VoiceResponse();
    errorResponse.say({ 'voice': 'alice' }, "We don't have a match for you!  Please try again later.");

    if (result.empty) {
        console.error(`No user with phone number '${phone}'`);
        return errorResponse;
    }
    console.log("Finding conference for user with phone number " + phone);
    const userId = result.docs[0].id;
    const match = await admin.firestore().collection("matches")
        .where("user_ids", "array-contains", userId)
        .where("created_at", "==", moment().utc().startOf("hour")).get();
    if (match.empty) {
        return errorResponse;
    }

    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial({ timeLimit: parseInt(functions.config().twilio.time_limit_sec) });
    dial.conference({
        // @ts-ignore
        jitterBufferSize: functions.config().twilio.jitter_buffer_size,
        participantLabel: userId,
        waitUrl: "http://twimlets.com/holdmusic?Bucket=com.twilio.music.guitars",
        statusCallbackEvent: ["join", "end"],
        statusCallback: BASE_URL + "conferenceStatusWebhook",
    }, match.docs[0].id);

    return twiml;
}

export async function callStudio(mode: string, matches: QueryDocumentSnapshot[]) {
    console.log(`executing '${mode}' for the following matches: ` + matches.map(doc => doc.id));
    const userARefs = matches.map(doc => admin.firestore().collection("users").doc(doc.get("user_a_id")));
    const userBRefs = matches.map(doc => admin.firestore().collection("users").doc(doc.get("user_b_id")));

    const allUsers = await admin.firestore().getAll(...userARefs.concat(userBRefs));
    const allUsersById = Object.assign({}, ...allUsers.map(user => ({ [user.id]: user })));

    const latestMatchesByUserId: Record<string, any> = {}
    for (const u of allUsers) {
        const latestMatch = await admin.firestore().collection("matches")
            .where("user_ids", "array-contains", u.id)
            .orderBy("created_at", "desc")
            .limit(1)
            .get();
        latestMatchesByUserId[u.id] = latestMatch.docs[0];
    };

    const userAPromises = matches.map(async doc => {
        const userA = allUsersById[doc.get("user_a_id")];
        const userB = allUsersById[doc.get("user_b_id")];
        const nextMatchParams = await nextMatchNameAndDate(latestMatchesByUserId, doc, userA.id);
        return client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
            to: userA.get("phone"),
            from: TWILIO_NUMBER,
            parameters: {
                mode,
                userId: userA.id,
                matchId: doc.id,
                firstName: userA.get("firstName"),
                matchName: userB.get("firstName"),
                matchPhone: userB.get("phone").substring(2),
                ...nextMatchParams,
            }
        });
    });

    const userBPromises = matches.map(async doc => {
        const userA = allUsersById[doc.get("user_a_id")];
        const userB = allUsersById[doc.get("user_b_id")];
        const nextMatchParams = await nextMatchNameAndDate(latestMatchesByUserId, doc, userB.id);
        return client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
            to: userB.get("phone"),
            from: TWILIO_NUMBER,
            parameters: {
                mode,
                userId: userB.id,
                matchId: doc.id,
                firstName: userB.get("firstName"),
                matchName: userA.get("firstName"),
                matchPhone: userA.get("phone").substring(2),
                ...nextMatchParams,
            }
        });
    });

    await Promise.all(userAPromises.concat(userBPromises));
}

export async function nextMatchNameAndDate(matchesByUserId: Record<string, any>, currMatch: any, userId: string) {
    const nextMatch = matchesByUserId[userId];
    if (nextMatch && nextMatch.id === currMatch.id) {
        return {};
    }
    const nextMatchUserId = nextMatch.get("user_a_id") === userId ? nextMatch.get("user_b_id") : nextMatch.get("user_a_id");
    console.log(nextMatchUserId);
    const nextMatchUser = await admin.firestore().collection("users").doc(nextMatchUserId).get();
    return {
        nextMatchName: nextMatchUser.get("firstName"),
        nextMatchDate: moment(nextMatch.get("created_at")).format("dddd"),
    }
}