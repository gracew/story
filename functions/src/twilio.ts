const VoiceResponse = require('twilio').twiml.VoiceResponse;
import * as admin from "firebase-admin";

const TWILIO_NUMBER = '+12036338466';
const accountSid = 'AC07d4a9a61ac7c91f7e5cecf1e27c45a6';
const authToken = 'e4cac763ca2438390561cb3b1c2f6b72';
const client = require('twilio')(accountSid, authToken);


export const getConferenceTwimlForPhone = async (phone_number: string, null_on_error=true) => {
    const users = admin.firestore().collection("users");
    const result = await users.where("phone", "==", phone_number).get();
    let error_response = null;
    if (!null_on_error) {
        error_response = new VoiceResponse();
        error_response.say({
            'voice': 'alice',
        }, "We don't have a match for you!  Please try again later.");
    }

    if (result.empty) {
        console.log("ERROR | No user with phone number " + phone_number);
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
        if (!match_result || (match_result.data()['created_at']  < match_b_result_doc.data()['created_at'])) {
            match_result = match_b_result_doc;
        }
    }
    if (!match_result) {
        return error_response;
    }
    const twiml = new VoiceResponse();
    const dial = twiml.dial();
    dial.conference(match_result.id);
    return twiml;
}

export const callNumberWithTwiml = async (number: string, twiml: any) => {
    client.calls
      .create({
         twiml: twiml.toString(),
         to: number,
         from: TWILIO_NUMBER
       })
      .then((call: { sid: any; }) => console.log(call.sid));
}
