import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as twilio from "twilio";
import * as moment from "moment";
import { Firestore, IMatch } from "./firestore";

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

export async function callStudio(mode: string, matches: IMatch[], firestore: Firestore) {
    console.log(`executing '${mode}' for the following matches: ` + matches.map(doc => doc.id));
    const allUsersById = await firestore.getUsersForMatches(matches);

    const latestMatchesByUserId: Record<string, any> = {}
    for (const id of Object.keys(allUsersById)) {
        latestMatchesByUserId[id] = await firestore.latestMatchForUser(id);
    };

    const userAPromises = matches.map(async match => {
        const userAId = match.user_a_id;
        const userA = allUsersById[match.user_a_id];
        const userB = allUsersById[match.user_b_id];
        const nextMatchParams = await nextMatchNameAndDate(latestMatchesByUserId, match, userAId, firestore);
        return client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
            to: userA.phone,
            from: TWILIO_NUMBER,
            parameters: {
                mode,
                userId: userAId,
                matchId: match.id,
                firstName: userA.firstName,
                matchName: userB.firstName,
                matchPhone: userB.phone.substring(2),
                ...nextMatchParams,
            }
        });
    });

    const userBPromises = matches.map(async match => {
        const userBId = match.user_b_id;
        const userA = allUsersById[match.user_a_id];
        const userB = allUsersById[match.user_b_id];
        const nextMatchParams = await nextMatchNameAndDate(latestMatchesByUserId, match, userBId, firestore);
        return client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
            to: userB.phone,
            from: TWILIO_NUMBER,
            parameters: {
                mode,
                userId: userBId,
                matchId: match.id,
                firstName: userB.firstName,
                matchName: userA.firstName,
                matchPhone: userA.phone.substring(2),
                ...nextMatchParams,
            }
        });
    });

    await Promise.all(userAPromises.concat(userBPromises));
}

export async function saveRevealHelper(body: { phone: string, reveal: string, matchId: string }, firestore: Firestore) {
    const phone = body.reveal;
    const reveal = body.reveal.trim().toLowerCase() === "y" || body.reveal.trim().toLowerCase() === "yes";
    const revealingUser = await firestore.getUserByPhone(phone);
    // check if user exists in table
    if (!revealingUser) {
        console.error("No user with phone " + phone);
        return;
    }

    const match = await firestore.getMatch(body.matchId);
    if (!match) {
        console.error("Could not find match with id " + body.matchId)
        return;
    }

    let otherUser;
    let otherReveal;
    if (match.user_a_id === revealingUser.id) {
        otherUser = await firestore.getUser(match.user_b_id);
        otherReveal = match.user_b_revealed;
        await firestore.updateMatch(match.id, { user_a_revealed: reveal });
    } else if (match.user_b_id === revealingUser.id) {
        otherUser = await firestore.getUser(match.user_a_id);
        otherReveal = match.user_a_revealed;
        await firestore.updateMatch(match.id, { user_b_revealed: reveal });
    }

    if (!otherUser) {
        console.error("Requested match doesnt have the requested users");
        return;
    }
    const latestMatchOther = await firestore.latestMatchForUser(otherUser.id)
    const otherNextMatch = await nextMatchNameAndDate(
        { [otherUser.id]: latestMatchOther! }, match, otherUser.id, firestore);

    const otherData = {
        userId: otherUser.id,
        firstName: otherUser.firstName,
        matchName: revealingUser.firstName,
        matchPhone: revealingUser.phone.substring(2),
    };

    if (reveal && otherReveal) {
        await client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
            to: otherUser.phone,
            from: TWILIO_NUMBER,
            parameters: {
                mode: "reveal",
                ...otherData,
                ...otherNextMatch,
            }
        });
        return { next: "reveal" };
    } else if (reveal && otherReveal === false) {
        return { next: "reveal_other_no" };
    } else if (reveal && otherReveal === undefined) {
        return { next: "reveal_other_pending" };
    } else if (!reveal) {
        if (otherReveal) {
            await client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
                to: otherUser.phone,
                from: TWILIO_NUMBER,
                parameters: {
                    mode: "reveal_other_no",
                    ...otherData,
                    ...otherNextMatch,
                },
            });
        }
        return { next: "no_reveal" };
    }
    return;
}

async function nextMatchNameAndDate(matchesByUserId: Record<string, IMatch>, currMatch: IMatch, userId: string, firestore: Firestore) {
    const nextMatch = matchesByUserId[userId];
    if (nextMatch && nextMatch.id === currMatch.id) {
        return {};
    }
    const nextMatchUserId = nextMatch.user_a_id === userId ? nextMatch.user_b_id : nextMatch.user_a_id;
    console.log(nextMatchUserId);
    const nextMatchUser = await firestore.getUser(nextMatchUserId);
    return {
        nextMatchName: nextMatchUser!.firstName,
        nextMatchDate: moment(nextMatch.created_at).format("dddd"),
    }
}

export function sendSms(opts: any) {
    return client.messages.create(opts).catch(err => console.error(err));
}
