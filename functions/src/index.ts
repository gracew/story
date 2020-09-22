// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as fs from 'fs';
import * as moment from "moment";
import * as os from 'os';
import * as path from 'path';
import * as twilio from 'twilio';
import * as util from "util";
import { addUserToAirtable } from './airtable';
import { BASE_URL, callStudio, client, getConferenceTwimlForPhone, TWILIO_NUMBER } from "./twilio";

admin.initializeApp();


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


export const registerUser = functions.https.onRequest(async (req, response) => {

    const answersIdMap: { [key: string]: string } = {
        "2a57e142-a19d-47a6-b9e7-e44e305020ae": "firstName",
        "26da12e0-58dd-4c2d-94c3-43ce603e7845": "lastName",
        "5c4ac50c-5f56-479e-8f26-79c0a8fbcf2f": "age",
        "51a54426-5dd2-4195-ac3a-bc8bf63857aa": "gender",
        "1a448624-668f-4904-b1dc-238ab0918ab3": "race",
        "cb8abb92-a2ee-4d68-8e66-4f20a41ca617": "email",
        "9cd16471-ba75-4b5a-8575-e9c59a76707b": "location",
        "e20e886c-b4c9-47c9-a8fc-6801602225d2": "locationFlexibility",
        "66620ef7-31d3-4269-b5be-4b5786793ec0": "agePreference",
        "6f60bcbb-622f-4b94-9671-e9f361bdffd7": "phone",
        "46b2e2ef-78b4-4113-af23-9f6b43fdab5c": "genderPreference",
        "01093a01-0f3a-44b7-a595-2759523f3e48": "funFacts",
        "bad634b9-0941-45e8-9dce-9f70f94b63cc": "interests",
        "81a72b3b-f161-4fe3-86c8-2313634be26f": "social",
        "c2edd041-e6a2-406a-81a0-fa66868059a4": "whereDidYouHearAboutVB"
    }

    const user: { [key: string]: any } = {
        "referrer": req.body.form_response.hidden.referrer,
        "signUpDate": req.body.form_response.submitted_at
    }


    const answers = req.body.form_response.answers;
    console.log(answers);

    for (const a of answers) {
        const refff: string = a.field.ref;
        const key = answersIdMap[refff];
        if (key === undefined) {
            continue;
        }
        console.log(key);
        if (a.type === 'text' || a.type === "boolean" || a.type === "email" || a.type === 'number' || a.type === 'phone_number' || a.type === 'long_text' || a.type === 'short_text') {
            user[key] = a[a.type];
        } else if (a.type === 'choice') {
            user[key] = a.choice.label ? a.choice.label : a.choice.other
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

    const reff = admin.firestore().collection("users").doc();
    user.id = reff.id;
    user.registeredAt = admin.firestore.FieldValue.serverTimestamp();
    await reff.set(user);

    addUserToAirtable(user)

    response.send({ 'success': 'true' })
});

/**
CSV is of the format: phone,textBody
 */
export const bulkSms = functions.storage.object().onFinalize(async (object) => {
    if (!(object.name && object.name.startsWith("bulksms"))) {
        return;
    }
    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    await admin.storage().bucket(object.bucket).file(object.name).download({ destination: tempFilePath });
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = contents.split("\n");
    await Promise.all(rows.map(row => {
        const cols = row.split(",");
        const phone = cols[0];
        const body = cols[1];
        return client.messages
            .create({
                body,
                from: TWILIO_NUMBER,
                to: phone,
            });
    }));
});


/**
Helper function for createMatches
 */
function processTimeZone(tz:string) {
    console.log(`"${tz}"`)    
    console.log(tz === "PT")
    if (tz === "PT") {return "America/Los_Angeles"}    
    else if(tz === "CT") {return "America/Chicago"}
    else if(tz === "ET") {return "America/New_York"}
    else {return "error"}
}
/**
CSV is of the format: userA ID,userB ID,call date(MM-DD-YYYY), call time (hh:mm a), timezone
 */
export const createMatches = functions.storage.object().onFinalize(async (object) => {
    if (!(object.name && object.name.startsWith("matchescsv"))) {
        return;
    }

    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    await admin.storage().bucket(object.bucket).file(object.name).download({ destination: tempFilePath });
    const contents = fs.readFileSync(tempFilePath).toString();
    const rows = contents.split("\n");

    rows.forEach(async row => {
        const cols = row.split(",");
        
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

        var m = require('moment-timezone');

        const callDate: string = cols[2]
        const callTime: string = cols[3]
        let timezone: string = processTimeZone(cols[4])
        console.log(timezone)
        
        const created_at = m.tz(callDate +" "+callTime, "MM-DD-YYYY hh:mm:ss a", timezone)

        console.log(created_at)

        const match: { [key: string]: any } = {
                "user_a_id": user_a_id,
                "user_b_id": user_b_id,
                "user_ids": [user_a_id, user_b_id],
                "created_at": created_at
            }
        
        console.log(match)
            
        console.log("creating match for " + user_a.data()!.firstName + "-" + user_b.data()!.firstName);

        const reff = admin.firestore().collection("matches").doc();
            match.id = reff.id;
            await reff.set(match)
    });
});



// runs every hour
export const sendReminderTexts = functions.pubsub.schedule('0 * * * *').onRun(async (context) => {
    const todaysMatches = await admin
        .firestore()
        .collection("matches")
        .where("created_at", "==", moment().utc().startOf("hour").add(1, "hour"))
        .get();
    console.log("found the following matches: " + todaysMatches.docs.map(doc => doc.id));

    const userAIds = todaysMatches.docs.map(doc => doc.get("user_a_id"));
    const userBIds = todaysMatches.docs.map(doc => doc.get("user_b_id"));
    const userIds = userAIds.concat(userBIds);
    console.log("sending texts to the following users: " + userIds);

    const users = await admin.firestore().getAll(...userIds.map(id => admin.firestore().collection("users").doc(id)));
    const usersById = Object.assign({}, ...users.map(user => ({ [user.id]: user })));

    const allPromises: Array<Promise<any>> = []
    todaysMatches.docs.forEach(doc => {
        const userA = usersById[doc.get("user_a_id")];
        const userB = usersById[doc.get("user_b_id")];
        allPromises.push(textUserHelper(userA, userB, doc.get("callIn")))
        allPromises.push(textUserHelper(userB, userA, doc.get("callIn")))
    })

    await Promise.all(allPromises);
});

// TODO(gracew): type inputs
async function textUserHelper(userA: any, userB: any, callIn: boolean) {
    const callInText = callIn ? " Make sure to call us at (203) 633-8466 to be connected." : "";
    const body = `Hi ${userA.get("firstName")}! This is Voicebar. Just a reminder that you’ll be speaking with ${userB.get("firstName")} in an hour.${callInText} Hope you two have a good conversation!`;

    await client.messages
        .create({
            body,
            from: TWILIO_NUMBER,
            to: userA.get("phone"),
        })
}

// runs every hour
export const issueCalls = functions.pubsub.schedule('0 * * * *').onRun(async (context) => {
    const todaysMatches = await admin
        .firestore()
        .collection("matches")
        .where("created_at", "==", moment().utc().startOf("hour"))
        .get();
    console.log("found the following matches: " + todaysMatches.docs.map(doc => doc.id));

    // don't issue calls where callIn === true
    const todaysMatchesCallOut = todaysMatches.docs.filter(m => m.get("callIn") !== true)
    console.log("calling out for the following matches: " + todaysMatchesCallOut.map(doc => doc.id));

    const userAIds = todaysMatchesCallOut.map(doc => doc.get("user_a_id"));
    const userBIds = todaysMatchesCallOut.map(doc => doc.get("user_b_id"));
    const userIds = userAIds.concat(userBIds);
    console.log("issuing calls to the following users: " + userIds);

    await Promise.all(userIds.map(id => callUserHelper(id)));
});

export const callStudioManual = functions.https.onRequest(
    async (request, response) => {
        const matchId = request.body.matchId;
        const match = await admin
            .firestore()
            .collection("matches")
            .doc(matchId)
            .get();
        // @ts-ignore
        return callStudio(request.body.mode, [match])
    });

// runs every hour at 35 minutes past
export const revealRequest = functions.pubsub.schedule('35 * * * *').onRun(async (context) => {
    const todaysMatches = await admin
        .firestore()
        .collection("matches")
        .where("created_at", "==", moment().utc().startOf("hour"))
        .get();
    const connectedMatches = todaysMatches.docs.filter(m => m.get("twilioSid") !== undefined);
    return callStudio("reveal_request", connectedMatches)
});

export const saveReveal = functions.https.onRequest(
    async (request, response) => {
        const phone = request.body.phone;
        const reveal = request.body.reveal.trim().toLowerCase() === "y" || request.body.reveal.trim().toLowerCase() === "yes";
        const users = await admin.firestore().collection("users");
        const revealing_user_query = await users.where("phone", "==", phone).get();
        // check if user exists in table
        if (revealing_user_query.empty) {
            console.error("No user with phone " + phone);
            response.end();
            return;
        }
        const revealing_user = revealing_user_query.docs[0];

        const match_query = await admin.firestore().collection("matches").where("user_ids", "array-contains", revealing_user.id).orderBy("created_at", "desc").limit(1).get();
        if (match_query.empty) {
            console.error("No match with phone " + phone);
            response.end();
            return;
        }
        const match_doc = match_query.docs[0]

        let other_user;
        let other_reveal;
        if (match_doc.get("user_a_id") === revealing_user.id) {
            other_user = await users.doc(match_doc.get("user_b_id")).get();
            other_reveal = match_doc.get("user_b_revealed")
            await match_doc.ref.update({ user_a_revealed: reveal });
        } else if (match_doc.get("user_b_id") === revealing_user.id) {
            other_user = await users.doc(match_doc.get("user_a_id")).get();
            other_reveal = match_doc.get("user_a_revealed")
            await match_doc.ref.update({ user_b_revealed: reveal });
        } else {
            console.error("Requested match doesnt have the requested users");
            response.end();
            return;
        }

        const other_data = {
            userId: other_user.id,
            firstName: other_user.data()!.firstName,
            matchName: revealing_user.data().firstName,
            matchPhone: revealing_user.data().phone.substring(2),
        };

        if (reveal && other_reveal) {
            await client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
                to: other_user.get("phone"),
                from: TWILIO_NUMBER,
                parameters: {
                    mode: "reveal",
                    ...other_data
                }
            });
            response.send({ next: "reveal" })
        } else if (reveal && other_reveal === false) {
            response.send({ next: "reveal_other_no" })
        } else if (reveal && other_reveal === undefined) {
            response.send({ next: "reveal_other_pending" })
        } else if (!reveal) {
            if (other_reveal) {
                await client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
                    to: other_user.get("phone"),
                    from: TWILIO_NUMBER,
                    parameters: {
                        mode: "reveal_other_no",
                        ...other_data
                    }
                });
            }
            response.send({ next: "no_reveal" })
        }

        response.end();
    }
);

export const markActive = functions.https.onRequest(
    async (request, response) => {
        const phone = request.body.phone;
        const user_query = await admin.firestore().collection("users").where("phone", "==", phone).get();
        if (user_query.empty) {
            console.error("No user with phone " + phone);
            response.end();
            return;
        }
        await user_query.docs[0].ref.update({ active: request.body.active });
        response.end();
    }
);

async function callUserHelper(user_id: string) {
    const ref = admin.firestore().collection("users").doc(user_id);
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

    await client.calls
        .create({
            url: BASE_URL + "screenCall",
            to: phone,
            from: TWILIO_NUMBER,
        })
    return { "success": "Calling " + phone };
}

export const callUser = functions.https.onCall(
    (request) => callUserHelper(request.user_id)
);

export const screenCall = functions.https.onRequest(
    async (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        const gather = twiml.gather({ numDigits: 1, action: BASE_URL + "/addUserToCall" });
        gather.say({ voice: "alice" }, 'Welcome to Voicebar. Press any key to continue.');

        // If the user doesn't enter input, loop
        twiml.redirect('/screenCall');

        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    });

export const addUserToCall = functions.https.onRequest(
    async (request, response) => {
        const caller_phone = request.body.Direction === "inbound" ? request.body.From : request.body.To;
        const twiml = await getConferenceTwimlForPhone(caller_phone, false);
        response.set('Content-Type', 'text/xml');
        response.send(twiml!.toString());
    }
);

export const conferenceStatusWebhook = functions.https.onRequest(
    async (request, response) => {
        if (request.body.StatusCallbackEvent === "participant-join") {
            const conference_sid = request.body.ConferenceSid;
            const participants = await client.conferences(conference_sid).participants.list();
            if (participants.length === 1) {
                return;
            }
            await admin.firestore().collection("matches").doc(request.body.FriendlyName).update({ "ongoing": true, "twilioSid": conference_sid })
            await client.conferences(conference_sid).update({ announceUrl: BASE_URL + "announceUser" })
            await util.promisify(setTimeout)(2500);
            await Promise.all(participants.map(participant =>
                client.conferences(conference_sid).participants(participant.callSid).update({ muted: false })))
        } else if (request.body.StatusCallbackEvent === "conference-end") {
            await admin.firestore().collection("matches").doc(request.body.FriendlyName).update({ "ongoing": false })
        }
        response.end();
    }
);

export const announceUser = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
            'voice': 'alice',
        }, "Your call is starting now.");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const announceEnd = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
            'voice': 'alice',
        }, "Your call will end in 5 minutes.");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const announce1Min = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
            'voice': 'alice',
        }, "Your call will end in 1 minute.");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

// runs every hour at 25 minutes past
export const callEndWarning = functions.pubsub.schedule('25 * * * *').onRun(async (context) => {
    const ongoingCalls = await admin
        .firestore()
        .collection("matches")
        .where("ongoing", "==", true)
        .get();
    await Promise.all(ongoingCalls.docs.map(doc => client.conferences(doc.get("twilioSid")).update({ announceUrl: BASE_URL + "announceEnd" })));
});

// runs every hour at 29 minutes past
export const call1MinWarning = functions.pubsub.schedule('29 * * * *').onRun(async (context) => {
    const ongoingCalls = await admin
        .firestore()
        .collection("matches")
        .where("ongoing", "==", true)
        .get();
    await Promise.all(ongoingCalls.docs.map(doc => client.conferences(doc.get("twilioSid")).update({ announceUrl: BASE_URL + "announce1Min" })));
});