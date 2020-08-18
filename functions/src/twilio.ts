import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as twilio from "twilio";
import moment = require("moment");

export const TWILIO_NUMBER = '+12036338466';
export const BASE_URL = 'https://us-central1-speakeasy-prod.cloudfunctions.net/';
const accountSid = 'AC07d4a9a61ac7c91f7e5cecf1e27c45a6';
const authToken = functions.config().twilio.auth_token;
export const client = twilio(accountSid, authToken);


export const getConferenceTwimlForPhone = async (phone_number: string, null_on_error = true) => {
    const users = admin.firestore().collection("users");
    const result = await users.where("phone", "==", phone_number).get();
    let error_response = null;
    if (!null_on_error) {
        error_response = new twilio.twiml.VoiceResponse();
        error_response.say({
            'voice': 'alice',
        }, "We don't have a match for you!  Please try again later.");
    }

    if (result.empty) {
        console.error(`No user with phone number '${phone_number}'`);
        return error_response;
    }
    console.log("Finding conference for user with phone number " + phone_number);
    const user_id = result.docs[0].id;
    const match = await admin.firestore().collection("matches").where("user_ids", "array-contains", user_id).orderBy("created_at", "desc").limit(1).get();
    if (match.empty) {
        return error_response;
    }

    const jitterBufferSize = functions.config().twilio.jitter_buffer_size;
    const timeLimit = parseInt(functions.config().twilio.time_limit_sec);

    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial({ timeLimit });
    dial.conference({
        // @ts-ignore
        jitterBufferSize: jitterBufferSize,
        participantLabel: user_id,
        waitUrl: "http://twimlets.com/holdmusic?Bucket=com.twilio.music.guitars",
        statusCallbackEvent: ["join", "end"],
        statusCallback: BASE_URL + "conferenceStatusWebhook",
        muted: true,
    }, match.docs[0].id);

    return twiml;
}

export async function callStudio(mode: string) {
    const todaysMatches = await admin
        .firestore()
        .collection("matches")
        .where("created_at", ">=", moment().utc().startOf("day"))
        .get();
    console.log("found the following matches: " + todaysMatches.docs.map(doc => doc.id));
    const userARefs = todaysMatches.docs.map(doc => admin.firestore().collection("users").doc(doc.get("user_a_id")));
    const userBRefs = todaysMatches.docs.map(doc => admin.firestore().collection("users").doc(doc.get("user_b_id")));

    const allUsers = await admin.firestore().getAll(...userARefs.concat(userBRefs));
    const allUsersById = Object.assign({}, ...allUsers.map(user => ({ [user.id]: user })));

    const userAPromises = todaysMatches.docs.map(doc => {
        const form = new FormData();
        form.append("Parameters", JSON.stringify({
            mode,
            firstName: allUsersById[doc.get("user_a_id")].get("firstName"),
            matchName: allUsersById[doc.get("user_b_id")].get("firstName"),
        }));
        return fetch(functions.config().twilio.flow_url, { method: "POST", body: form });
    });
    const userBPromises = todaysMatches.docs.map(doc => {
        const form = new FormData();
        form.append("Parameters", JSON.stringify({
            mode,
            firstName: allUsersById[doc.get("user_b_id")].get("firstName"),
            matchName: allUsersById[doc.get("user_a_id")].get("firstName"),
        }));
        return fetch(functions.config().twilio.flow_url, { method: "POST", body: form });
    });

    await Promise.all(userAPromises.concat(userBPromises));
}
