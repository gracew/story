import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import * as os from 'os';
import * as path from 'path';
import * as twilio from 'twilio';
import { addUserToAirtable } from './airtable';
import { BASE_URL, callStudio, client, getConferenceTwimlForPhone, nextMatchNameAndDate, TWILIO_NUMBER } from "./twilio";
import { processAvailabilityCsv, processBulkSmsCsv, processMatchCsv } from "./csv";
import { Firestore, IUser, matchesThisHour } from "./firestore";
import { reminder } from "./smsCopy";

admin.initializeApp();

/** Used by the frontend to verify that the phone number hasn't already been registered. */
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

/**
 * Used by the frontend to look up metadata for a user based on username (e.g. when navigating to voicebar.co/grace).
 */
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

/** Called upon typeform submission to save user data in firebase and airtable. */
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
 * Sends an SMS for each row in a CSV. The CSV should be in the format: phone,textBody. There should not be a header
 * line.
 */
export const bulkSms = functions.storage.object().onFinalize(async (object) => {
    if (!(object.name && object.name.startsWith("bulksms"))) {
        return;
    }
    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    await admin.storage().bucket(object.bucket).file(object.name).download({ destination: tempFilePath });
    await processBulkSmsCsv(tempFilePath)
});

/**
 * Sends an availability text for each row in a CSV. The CSV should be in the format: userId,timezone. The timezone
 * value will be directly inserted into the text and should be of the form "PT". There should not be a header line.
 */
export const sendAvailabilityTexts = functions.storage.object().onFinalize(async (object) => {
    if (!(object.name && object.name.startsWith("availability"))) {
        return;
    }
    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    await admin.storage().bucket(object.bucket).file(object.name).download({ destination: tempFilePath });
    await processAvailabilityCsv(tempFilePath, new Firestore());
});

/**
 * Creates a match for each row in a CSV. The CSV should be in the format: 
 * userAId,userBId,callDate (MM-DD-YYYY),callTime (hh:mm a),timezone. There should not be a header line. 
 */
export const createMatches = functions.storage.object().onFinalize(async (object) => {
    if (!(object.name && object.name.startsWith("matchescsv"))) {
        return;
    }

    const tempFilePath = path.join(os.tmpdir(), path.basename(object.name));
    await admin.storage().bucket(object.bucket).file(object.name).download({ destination: tempFilePath });

    await processMatchCsv(tempFilePath, new Firestore());
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
    const usersById = Object.assign({}, ...users.map(user => ({ [user.id]: user.data() })));

    const allPromises: Array<Promise<any>> = []
    todaysMatches.docs.forEach(doc => {
        const userA = usersById[doc.get("user_a_id")];
        const userB = usersById[doc.get("user_b_id")];
        allPromises.push(textUserHelper(userA, userB))
        allPromises.push(textUserHelper(userB, userA))
    })

    await Promise.all(allPromises);
});

async function textUserHelper(userA: IUser, userB: IUser) {
    await client.messages
        .create({
            body: reminder(userA, userB),
            from: TWILIO_NUMBER,
            to: userA.phone,
        })
}

// runs every hour
export const issueCalls = functions.pubsub.schedule('0 * * * *').onRun(async (context) => {
    const matches = await matchesThisHour();
    console.log("found the following matches: " + matches.docs.map(doc => doc.id));

    const userAIds = matches.docs.map(doc => doc.get("user_a_id"));
    const userBIds = matches.docs.map(doc => doc.get("user_b_id"));
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
    const matches = await matchesThisHour();
    const connectedMatches = matches.docs.filter(m => m.get("twilioSid") !== undefined);
    return callStudio("reveal_request", connectedMatches)
});

export const saveReveal = functions.https.onRequest(
    async (request, response) => {
        const phone = request.body.phone;
        const reveal = request.body.reveal.trim().toLowerCase() === "y" || request.body.reveal.trim().toLowerCase() === "yes";
        const users = await admin.firestore().collection("users");
        const revealingUserQuery = await users.where("phone", "==", phone).get();
        // check if user exists in table
        if (revealingUserQuery.empty) {
            console.error("No user with phone " + phone);
            response.end();
            return;
        }
        const revealingUser = revealingUserQuery.docs[0];

        const match = await admin.firestore().collection("matches").doc(request.body.matchId).get();

        let otherUser;
        let otherReveal;
        if (match.get("user_a_id") === revealingUser.id) {
            otherUser = await users.doc(match.get("user_b_id")).get();
            otherReveal = match.get("user_b_revealed")
            await match.ref.update({ user_a_revealed: reveal });
        } else if (match.get("user_b_id") === revealingUser.id) {
            otherUser = await users.doc(match.get("user_a_id")).get();
            otherReveal = match.get("user_a_revealed")
            await match.ref.update({ user_b_revealed: reveal });
        } else {
            console.error("Requested match doesnt have the requested users");
            response.end();
            return;
        }
        const latestMatchOther = await admin.firestore().collection("matches")
            .where("user_ids", "array-contains", otherUser.id)
            .orderBy("created_at", "desc")
            .limit(1)
            .get();
        const otherNextMatch = await nextMatchNameAndDate(
            { [otherUser.id]: latestMatchOther.docs[0] }, match, otherUser.id);

        const otherData = {
            userId: otherUser.id,
            firstName: otherUser.data()!.firstName,
            matchName: revealingUser.data().firstName,
            matchPhone: revealingUser.data().phone.substring(2),
        };

        if (reveal && otherReveal) {
            await client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
                to: otherUser.get("phone"),
                from: TWILIO_NUMBER,
                parameters: {
                    mode: "reveal",
                    ...otherData,
                    ...otherNextMatch,
                }
            });
            response.send({ next: "reveal" })
        } else if (reveal && otherReveal === false) {
            response.send({ next: "reveal_other_no" })
        } else if (reveal && otherReveal === undefined) {
            response.send({ next: "reveal_other_pending" })
        } else if (!reveal) {
            if (otherReveal) {
                await client.studio.flows("FW3a60e55131a4064d12f95c730349a131").executions.create({
                    to: otherUser.get("phone"),
                    from: TWILIO_NUMBER,
                    parameters: {
                        mode: "reveal_other_no",
                        ...otherData
                    },
                    ...otherNextMatch,
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
        const userQuery = await admin.firestore().collection("users").where("phone", "==", phone).get();
        if (userQuery.empty) {
            console.error("No user with phone " + phone);
            response.end();
            return;
        }
        await userQuery.docs[0].ref.update({ active: request.body.active });
        response.end();
    }
);

async function callUserHelper(userId: string) {
    const user = await admin.firestore().collection("users").doc(userId).get()
    if (!user.exists) {
        console.error("Could not make call for user that does not exist: " + userId)
    }

    await client.calls
        .create({
            url: BASE_URL + "screenCall",
            to: user.get("phone"),
            from: TWILIO_NUMBER,
        })
}

export const callUser = functions.https.onRequest(
    async (request, response) => {
        await callUserHelper(request.body.userId)
        response.end();
    }
);

export const screenCall = functions.https.onRequest(
    async (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        const gather = twiml.gather({ numDigits: 1, action: BASE_URL + "addUserToCall" });
        gather.say({ voice: "alice" }, 'Welcome to Voicebar. Press any key to continue.');

        // If the user doesn't enter input, loop
        twiml.redirect('/screenCall');

        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    });

/** Called directly for incoming calls. Also called for outbound calls after the user has passed the call screen. */
export const addUserToCall = functions.https.onRequest(
    async (request, response) => {
        const callerPhone = request.body.Direction === "inbound" ? request.body.From : request.body.To;
        const twiml = await getConferenceTwimlForPhone(callerPhone);
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const conferenceStatusWebhook = functions.https.onRequest(
    async (request, response) => {
        if (request.body.StatusCallbackEvent === "participant-join") {
            const conferenceSid = request.body.ConferenceSid;
            const participants = await client.conferences(conferenceSid).participants.list();
            if (participants.length === 1) {
                return;
            }
            await admin.firestore().collection("matches").doc(request.body.FriendlyName)
                .update({ "ongoing": true, "twilioSid": conferenceSid })
        } else if (request.body.StatusCallbackEvent === "conference-end") {
            await admin.firestore().collection("matches").doc(request.body.FriendlyName)
                .update({ "ongoing": false })
        }
        response.end();
    }
);

export const announce5Min = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({ 'voice': 'alice' }, "Your call will end in 5 minutes.");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const announce1Min = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({ 'voice': 'alice' }, "Your call will end in 1 minute.");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

// runs every hour at 25 minutes past
export const call5MinWarning = functions.pubsub.schedule('25 * * * *').onRun(async (context) => {
    const ongoingCalls = await admin
        .firestore()
        .collection("matches")
        .where("ongoing", "==", true)
        .get();
    await Promise.all(ongoingCalls.docs.map(doc =>
        client.conferences(doc.get("twilioSid"))
            .update({ announceUrl: BASE_URL + "announce5Min" })));
});

// runs every hour at 29 minutes past
export const call1MinWarning = functions.pubsub.schedule('29 * * * *').onRun(async (context) => {
    const ongoingCalls = await admin
        .firestore()
        .collection("matches")
        .where("ongoing", "==", true)
        .get();
    await Promise.all(ongoingCalls.docs.map(doc =>
        client.conferences(doc.get("twilioSid"))
            .update({ announceUrl: BASE_URL + "announce1Min" })));
});