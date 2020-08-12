import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as twilio from "twilio";

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
    const matches = admin.firestore().collection("matches");
    const match_a_result = await matches.where("user_a_id", "==", user_id).orderBy("created_at", "desc").limit(1).get();
    const match_b_result = await matches.where("user_b_id", "==", user_id).orderBy("created_at", "desc").limit(1).get();
    let match_result = null;
    if (!match_a_result.empty) {
        match_result = match_a_result.docs[0];
    }
    if (!match_b_result.empty) {
        const match_b_result_doc = match_b_result.docs[0];
        if (!match_result || (match_result.data()['created_at'] < match_b_result_doc.data()['created_at'])) {
            match_result = match_b_result_doc;
        }
    }
    if (!match_result) {
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
        statusCallbackEvent: ["join"],
        statusCallback: BASE_URL + "conferenceStatusWebhook",
        muted: true,
    }, match_result.id);

    return twiml;
}
