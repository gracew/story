import * as express from "express";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import * as twilio from "twilio";
import { Firestore, IMatch } from "./firestore";

export const TWILIO_NUMBER = 'MG35ade708f17b5ae9c9af44c95128182b';  // messaging service sid
export const BASE_URL = 'https://us-central1-speakeasy-prod.cloudfunctions.net/';
export const POST_CALL_FLOW_ID = "FW3a60e55131a4064d12f95c730349a131";
const accountSid = 'AC07d4a9a61ac7c91f7e5cecf1e27c45a6';
const authToken = functions.config().twilio.auth_token;
export const client = twilio(accountSid, authToken);

export function validateRequest(endpoint: string, request: express.Request) {
    const signature = request.header("X-Twilio-Signature") as string;
    if (!twilio.validateRequest(authToken, signature, BASE_URL + endpoint, request.body)) {
        throw new functions.https.HttpsError("permission-denied", "incorrect twilio signature");
    }
}

export async function getConferenceTwimlForPhone(phone: string) {
    const users = admin.firestore().collection("users");
    const result = await users.where("phone", "==", phone).get();
    const errorResponse = new twilio.twiml.VoiceResponse();
    errorResponse.say({ 'voice': 'alice' }, "We don't have a match for you!  Please try again later.");

    if (result.empty) {
        console.error(new Error(`No user with phone number '${phone}'`));
        return errorResponse;
    }
    console.log("Finding conference for user with phone number " + phone);
    const userId = result.docs[0].id;

    const firestore = new Firestore();
    const match = await firestore.currentMatchForUser(userId);
    if (!match) {
        return errorResponse;
    }
    await firestore.updateMatch(match.id, { ["joined." + userId]: true })

    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial();
    dial.conference({
        // @ts-ignore
        jitterBufferSize: functions.config().twilio.jitter_buffer_size,
        participantLabel: userId,
        waitUrl: "http://twimlets.com/holdmusic?Bucket=com.twilio.music.guitars",
        statusCallbackEvent: ["join", "end"],
        statusCallback: BASE_URL + "conferenceStatusWebhook",
        muted: true,
    }, match.id);

    return twiml;
}

export async function callStudio(mode: string, match: IMatch, firestore: Firestore, video: boolean, today: string) {
    console.log(`executing '${mode}' for match ${match.id}`);
    const allUsersById = await firestore.getUsersForMatches([match]);

    const nextMatchesByUserId: Record<string, any> = {}
    for (const id of Object.keys(allUsersById)) {
        nextMatchesByUserId[id] = await firestore.nextMatchForUser(id);
    };

    const nextDays = getNextDays(today, nextMatchesByUserId[match.user_a_id], nextMatchesByUserId[match.user_b_id]);
    const userAId = match.user_a_id;
    const userA = allUsersById[match.user_a_id];
    const userB = allUsersById[match.user_b_id];
    const userAPromise = client.studio.flows(POST_CALL_FLOW_ID).executions.create({
        to: userA.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode,
            photo: userA.photo && userB.photo ? "both_photo" : (!userA.photo ? "self_no_photo" : "other_no_photo"),
            userId: userAId,
            matchId: match.id,
            firstName: userA.firstName,
            matchUserId: userB.id,
            matchName: userB.firstName,
            matchPhone: userB.phone,
            ...(await nextMatchNameAndDate(userAId, firestore, nextMatchesByUserId[userAId])),
            nextDays,
            video,
        }
    });

    const userBId = match.user_b_id;
    const userBPromise = client.studio.flows(POST_CALL_FLOW_ID).executions.create({
        to: userB.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode,
            photo: userA.photo && userB.photo ? "both_photo" : (!userB.photo ? "self_no_photo" : "other_no_photo"),
            userId: userBId,
            matchId: match.id,
            firstName: userB.firstName,
            matchUserId: userA.id,
            matchName: userA.firstName,
            matchPhone: userA.phone,
            ...(await nextMatchNameAndDate(userBId, firestore, nextMatchesByUserId[userBId])),
            nextDays,
            video,
        }
    });

    await Promise.all([userAPromise, userBPromise]);
}

export async function saveRevealHelper(body: { phone: string, reveal: string, matchId: string }, firestore: Firestore, today: string) {
    const phone = body.phone;
    const reveal = parseUserReveal(body.reveal);
    if (reveal === undefined) {
        console.warn("Could not parse reveal response");
        return;
    }

    const revealingUser = await firestore.getUserByPhone(phone);
    if (!revealingUser) {
        console.error(new Error("No user with phone " + phone));
        return;
    }

    const match = await firestore.getMatch(body.matchId);
    if (!match) {
        console.error(new Error("Could not find match with id " + body.matchId))
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
        console.error(new Error("Requested match doesn't have the requested users"));
        return;
    }
    const nextMatchRevealing = await firestore.nextMatchForUser(revealingUser.id);
    const nextMatchOther = await firestore.nextMatchForUser(otherUser.id)
    const otherNextMatch = await nextMatchNameAndDate(otherUser.id, firestore, nextMatchOther);

    const otherData = {
        userId: otherUser.id,
        firstName: otherUser.firstName,
        matchUserId: revealingUser.id,
        matchName: revealingUser.firstName,
        matchPhone: revealingUser.phone,
    };

    if (reveal && otherReveal) {
        const nextDays = getNextDays(today, nextMatchRevealing, nextMatchOther);
        await client.studio.flows(POST_CALL_FLOW_ID).executions.create({
            to: otherUser.phone,
            from: TWILIO_NUMBER,
            parameters: {
                mode: "reveal",
                matchId: body.matchId,
                ...otherData,
                ...otherNextMatch,
                nextDays,
                video: match.mode === "video",
            }
        });
        return { next: "reveal" };
    } else if (reveal && otherReveal === false) {
        return { next: "reveal_other_no" };
    } else if (reveal && otherReveal === undefined) {
        return { next: "reveal_other_pending" };
    } else if (!reveal) {
        if (otherReveal) {
            await client.studio.flows(POST_CALL_FLOW_ID).executions.create({
                to: otherUser.phone,
                from: TWILIO_NUMBER,
                parameters: {
                    mode: "reveal_other_no",
                    matchId: body.matchId,
                    ...otherData,
                    ...otherNextMatch,
                    video: match.mode === "video",
                },
            });
        }
        return { next: "no_reveal" };
    }
    console.error(new Error(`unexpected combination for match ${match.id}, phone ${phone}, reveal ${reveal}, otherReveal ${otherReveal}`))
    return;
}

export function getNextDays(today: string, nextMatchRevealing?: IMatch, nextMatchOther?: IMatch) {
    const nextMatchDays = new Set();
    if (nextMatchRevealing) {
        nextMatchDays.add(moment(nextMatchRevealing.created_at.toDate()).tz("America/Los_Angeles").format("dddd"));
    }
    if (nextMatchOther) {
        nextMatchDays.add(moment(nextMatchOther.created_at.toDate()).tz("America/Los_Angeles").format("dddd"));
    }

    const potentialNextDays = ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    let availableNextDays: string[];
    if (today === "Tuesday") {
        availableNextDays = potentialNextDays.filter(day => !nextMatchDays.has(day))
    } else if (today === "Wednesday") {
        availableNextDays = potentialNextDays.slice(1).filter(day => !nextMatchDays.has(day))
    } else {
        availableNextDays = potentialNextDays.slice(2).filter(day => !nextMatchDays.has(day));
    }
    return availableNextDays.slice(0, 3).join(", ")
}

function parseUserReveal(reveal: string) {
    const normalized = reveal.trim().toLowerCase();
    if (normalized === "y" || normalized === "yes") {
        return true;
    }
    if (normalized === "n" || normalized === "no") {
        return false;
    }
    return undefined;
}

export interface NextMatchNameDate {
    nextMatchName: string;
    nextMatchDate: string;
}

export async function nextMatchNameAndDate(userId: string, firestore: Firestore, nextMatch?: IMatch) {
    if (!nextMatch) {
        return undefined;
    }
    const nextMatchUserId = nextMatch.user_a_id === userId ? nextMatch.user_b_id : nextMatch.user_a_id;
    const nextMatchUser = await firestore.getUser(nextMatchUserId);
    const nextMatchDate = moment(nextMatch.created_at.toDate()).tz("America/New_York").format("dddd");
    console.log(`next match ${nextMatch.id} for user ${userId}: created_at ${moment(nextMatch.created_at.toDate()).format()}, formatted day ${nextMatchDate}`);
    return {
        nextMatchName: nextMatchUser!.firstName,
        nextMatchDate,
    }
}

export function sendSms(opts: any) {
    return client.messages.create({
        ...opts,
        from: TWILIO_NUMBER,
        statusCallback: BASE_URL + "smsStatusCallback",
    }).catch(console.error);
}
