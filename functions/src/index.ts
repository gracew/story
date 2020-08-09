// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as twilio from 'twilio';
import { callNumberWithTwiml, getConferenceTwimlForPhone, getCallStartingTwiml, announceToConference } from "./twilio";

admin.initializeApp();

const requestLib = require('request');

export const phoneRegistered = functions.https.onCall(async (request) => {
    const normalizedPhone = request.phone.split(" ").join("");

    // make sure the phone number hasn't already been registered
    const existingUser = await admin
        .firestore()
        .collection("users")
        .where("phone", "==", normalizedPhone)
        .get();
    return !existingUser.empty;
});

export const registerUser = functions.https.onRequest(async (req, response) => {

    const answersIdMap : {[key: string]: string} = {
        "2a57e142-a19d-47a6-b9e7-e44e305020ae": "firstName",
        "5c4ac50c-5f56-479e-8f26-79c0a8fbcf2f": "age",
        "51a54426-5dd2-4195-ac3a-bc8bf63857aa": "gender",
        "6f60bcbb-622f-4b94-9671-e9f361bdffd7": "phone",
        "9cd16471-ba75-4b5a-8575-e9c59a76707b": "city",
        "46b2e2ef-78b4-4113-af23-9f6b43fdab5c": "genderPreference",
        "01093a01-0f3a-44b7-a595-2759523f3e48": "funFacts",
        "c2edd041-e6a2-406a-81a0-fa66868059a4": "whereDidYouHearAboutVB"
    }

    const user: {[key: string]: any} = {};

    const answers = req.body.form_response.answers;
    console.log(answers);

    for (const a of answers) {
        const refff: string = a.field.ref;
        const key = answersIdMap[refff];
        console.log(key);
        if (a.type === 'text' || a.type === 'number' || a.type === 'phone_number' || a.type === 'long_text' || a.type === 'short_text') {
            user[key] = a[a.type];
        } else if (a.type === 'choice') {
            user[key] = a.choice.label;
        } else if (a.type === 'choices') {
            user[key] = a.choices.labels;
        }
    }


    user.phone = user.phone.split(" ").join("");


    // make sure the phone number hasn't already been registered
    const ue = await admin
        .firestore()
        .collection("users")
        .where("phone", "==", user.phone)
        .get();
    if (!ue.empty) {
        throw new functions.https.HttpsError(
            "already-exists",
            "phone number has already been registered"
        );
    }

    // async function usernameAvailable(proposed: string) {
    //     const existingUsername = await admin
    //         .firestore()
    //         .collection("users")
    //         .where("username", "==", proposed)
    //         .get();
    //     return existingUsername.docs.length === 0;
    // }
    // function randomBetween1and100() {
    //     return Math.floor(Math.random() * 100);
    // }

    // // generate unique username/link
    // let username = request.firstName as string;
    // username = username.trim().toLowerCase();
    // while (!(await usernameAvailable(username))) {
    //     username = username + randomBetween1and100();
    //     // NOTE(gracew): this might go on forever if there are more than 100 people with this first name
    // }

    const reff = admin.firestore().collection("users").doc();
    user.id = reff.id;
    user.registeredAt = admin.firestore.FieldValue.serverTimestamp();
    await reff.set(user);
    response.send({'success': 'true'})
});

/**
 * The file is expected to be in CSV format where the first line is the header (skipped in processing). Each subsequent
 * row is expected to have the user ID in the first column and an allowed boolean in the second column. Subsequent
 * columns are ignored. Example:
 *
 * id,allowed,firstName,lastName
 * 1,TRUE,Grace,Wang
 * 2,FALSE,Minh,Pham
 */ 
export const markAllowed = functions.storage.object().onFinalize(async (object) => {
    if (object.name !== "allowedUsers.csv") {
        return;
    }
    const tempFilePath = path.join(os.tmpdir(), object.name);
    await admin.storage().bucket(object.bucket).file(object.name).download({ destination: tempFilePath });
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = contents.split("\n").slice(1);
    rows.forEach(async row => {
        const cols = row.split(",");
        if (cols.length > 2) {
            const id = cols[0];
            const allowed = cols[1] === "TRUE" ? true : false;
            await admin.firestore().collection("users").doc(id).update({ allowed })
        }
    });
});

// Runs every day at 7pm GMT or noon PT
export const sendOptInText = functions.pubsub.schedule('every day 19:00').onRun(async (context) => {
    const allowedUsers = await admin
        .firestore()
        .collection("users")
        .where("allowed", "==", true)
        .get();
    allowedUsers.docs.forEach(doc => {
        // TODO(gracew): call messagebird
    })
});

/**
format

user_a_id, user_b_id
 */
export const createMatches = functions.storage.object().onFinalize(async (object) => {
    if (object.name !== "matches.csv") {
        return;
    }
    const tempFilePath = path.join(os.tmpdir(), object.name);
    await admin.storage().bucket(object.bucket).file(object.name).download({ destination: tempFilePath });
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = contents.split("\n").slice(1);
    rows.forEach(async row => {
        const cols = row.split(",");
        if (cols.length === 2) {
            const user_a_id: string = cols[0];
            const user_b_id: string = cols[1];

            const user_a = await admin.firestore().collection("users").doc(user_a_id).get();
            const user_b = await admin.firestore().collection("users").doc(user_b_id).get();

            if (!user_a.exists) {
                console.error("ERROR | cannot find user with id " + user_a_id);
                return;
            }
            if (!user_b.exists) {
                console.error("ERROR | cannot find user with id " + user_b_id);
                return;
            }

            console.log(" about to create match for " + user_a.data()!.firstName + "-" + user_b.data()!.firstName);

            const match = admin.firestore().collection("matches").doc(user_a.data()!.firstName + "-" + user_b.data()!.firstName + "-" + Date.now());
            await match.set({
                user_a_id: user_a_id,
                user_b_id: user_b_id,
                user_a_revealed: false,
                user_b_revealed: false,
                created_at: Date.now()
            })

            console.log("creating match for " + user_a.data()!.firstName + "-" + user_b.data()!.firstName);

            const formData = {
                "mode": "voice_bio",
                "name": user_a.data()!.firstName,
                "phone_number": user_a.data()!.phone,
                "match_name": user_b.data()!.firstName,
                "match_gender_pronoun": user_b.data()!.gender === 'male' ? "he" : "she",
                "match_gender_pronoun_possessive": user_b.data()!.gender === 'male' ? "his" : "her",
                "match_voice_bio_url": user_b.data()!.bio,
                "match_id": match.id
            }

            requestLib.post({ url: 'https://flows.messagebird.com/flows/f97ab91a-ece1-470b-908b-81525f07251a/invoke', json: formData }, function (error: any, r: any, body: any) {
                if (r.statusCode === 204) {
                    console.log("successfully revealed sent voice bio 1");
                } else {
                    console.error('error:', error); // Print the error if one occurred
                    console.log('statusCode:', r && r.statusCode); // Print the response status code if a response was received
                }
            });

            const formData2 = {
                "mode": "voice_bio",
                "name": user_b.data()!.firstName,
                "phone_number": user_b.data()!.phone,
                "match_name": user_a.data()!.firstName,
                "match_gender_pronoun": user_a.data()!.gender === 'male' ? "he" : "she",
                "match_gender_pronoun_possessive": user_a.data()!.gender === 'male' ? "his" : "her",
                "match_voice_bio_url": user_a.data()!.bio,
                "match_id": match.id
            }

            requestLib.post({ url: 'https://flows.messagebird.com/flows/f97ab91a-ece1-470b-908b-81525f07251a/invoke', json: formData2 }, function (error: any, r: any, body: any) {
                if (r.statusCode === 204) {
                    console.log("successfully sent voice bio 2");
                } else {
                    console.error('error:', error); // Print the error if one occurred
                    console.log('statusCode:', r && r.statusCode); // Print the response status code if a response was received
                }
            });

        }
    });
});

export const callUser = functions.https.onCall(
    async (request) => {
        const ref = admin.firestore().collection("users").doc(request.user_id);
        const user_doc = await ref.get();
        const user_doc_data = user_doc.data()
        if (!user_doc.exists || !user_doc_data) {
            return { "error": "User does not exist!" };
        }
        const phone = user_doc_data.phone;
        const twiml = await getConferenceTwimlForPhone(phone, true);
        if (!twiml) {
            return { "error": "User has no current matches!" };
        }
        await callNumberWithTwiml(phone, twiml);
        return { "success": "Calling " + phone };
    }
);

export const optIn = functions.https.onRequest(
    async (request, response) => {
        const phone_number = request.body.phone_number;
        const users = admin.firestore().collection("users");
        const result = await users.where("phone", "==", phone_number).get();

        if (result.empty) {
            console.log("ERROR | No user with phone number " + phone_number);
            response.send({ success: false, message: "User does not exist" });
        } else {
            console.log("Opting in user with phone number " + phone_number);
            const user_id = result.docs[0].id;

            await admin.firestore().collection("optIns").doc().set({
                user_id: user_id,
                created_at: Date.now()
            })
            response.send({ success: true });
        }
    }
);

export const reveal = functions.https.onRequest(
    async (request, response) => {
        const match_id = request.body.match_id;
        const phone_number = request.body.phone_number;

        const match_doc_ref = admin.firestore().collection("matches").doc(match_id);
        let match_doc = await match_doc_ref.get();
        if (!match_doc.exists || match_doc.data() === undefined) {
            console.log("ERROR | No match with id " + match_id);
            response.send({ success: false, message: "Match does not exist" });
        } else {
            const users = await admin.firestore().collection("users");

            const user_a_query = await users.where("phone", "==", phone_number).get();

            console.log("user is revealing " + phone_number);
            // check if user exists in table
            if (user_a_query.empty) {
                console.log("ERROR | User does not exist");
                response.send({ success: false, message: "User does not exist" });
                return;
            }

            const user_a = user_a_query.docs[0];
            console.log("Reveailing user id " + user_a.id);

            let user_b;

            if (match_doc.data()!.user_a_id === user_a.id) {
                user_b = await users.doc(match_doc.data()!.user_b_id).get();
                await match_doc_ref.update({ user_a_revealed: true });

            } else if (match_doc.data()!.user_b_id === user_a.id) {
                user_b = await users.doc(match_doc.data()!.user_a_id).get();
                await match_doc_ref.update({ user_b_revealed: true });
            } else {
                console.log("ERROR | Requested match doesnt have the requested users ");
                response.send({ success: false, message: "Requested match doesnt have the requested users" });
            }

            if (user_b === undefined) {
                console.log("ERROR | User b does not exist");
                response.send({ success: false, message: "User B does not exist" });
                return;
            }

            match_doc = await match_doc_ref.get();

            if (match_doc.data()!.user_a_revealed === true && match_doc.data()!.user_b_revealed === true) {

                // TODO fix pronouns
                const formData = {
                    "mode": "reveal",
                    "name": user_a.data().firstName,
                    "phone_number": user_a.data().phone,
                    "match_name": user_b.data()!.firstName,
                    "match_phone_number": user_b.data()!.phone.substring(1),
                    "match_gender_pronoun": "they",
                    "match_gender_pronoun_possessive": "their",
                }

                console.log("Revealing phone number 1");
                requestLib.post({ url: 'https://flows.messagebird.com/flows/f97ab91a-ece1-470b-908b-81525f07251a/invoke', json: formData }, function (error: any, r: any, body: any) {
                    if (r.statusCode === 204) {
                        console.log("successfully revealed first phone number");
                    } else {
                        console.error('error:', error); // Print the error if one occurred
                        console.log('statusCode:', r && r.statusCode); // Print the response status code if a response was received
                        response.send({ success: false })
                    }
                });

                const formData2 = {
                    "mode": "reveal",
                    "name": user_b.data()!.firstName,
                    "phone_number": user_b.data()!.phone,
                    "match_name": user_a.data().firstName,
                    "match_phone_number": user_a.data().phone.substring(1),
                    "match_gender_pronoun": "they",
                    "match_gender_pronoun_possessive": "their",
                }

                console.log("Revealing phone number 2");
                requestLib.post({ url: 'https://flows.messagebird.com/flows/f97ab91a-ece1-470b-908b-81525f07251a/invoke', json: formData2 }, function (error: any, r: any, body: any) {
                    if (r.statusCode === 204) {
                        console.log("successfully revealed second phone number");
                    } else {
                        console.error('error:', error); // Print the error if one occurred
                        console.log('statusCode:', r && r.statusCode); // Print the response status code if a response was received
                        response.send({ success: false });
                    }
                });

            }

            response.send({ success: true });

        }
    }
);

export const addUserToCall = functions.https.onRequest(
    async (request, response) => {
        const caller_phone = request.body.From;
        const twiml = await getConferenceTwimlForPhone(caller_phone, false);
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const conferenceStatusWebhook = functions.https.onRequest(
    async (request, response) => {
        const conference_sid = request.body.ConferenceSid;
        await announceToConference(conference_sid);
    }
);

export const announceUser = functions.https.onRequest(
    async (request, response) => {
        const twiml = await getCallStartingTwiml();
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const getUserByUsername = functions.https.onCall(
    async (request) => {
        const user = await admin
            .firestore()
            .collection("users")
            .where("username", "==", request.username)
            .get();
        if (user.empty) {
            throw new functions.https.HttpsError(
                "not-found",
                "unknown username"
            );
        }
        const { firstName, age, bio, prompt, gender } = user.docs[0].data();
        return { firstName, age, bio, prompt, gender };
    }
);

export const smsReply = functions.https.onRequest((req, res) => {
    const messageRes = new twilio.twiml.MessagingResponse();
    // this is just for notification purposes, replies need to be made in the Twilio console
    messageRes.message({ to: functions.config().twilio.notify_phone, }, "User responded to Twilio SMS");

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(messageRes.toString());
});