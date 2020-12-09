import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import * as os from 'os';
import * as path from 'path';
import * as twilio from 'twilio';
import * as util from "util";
import * as firestore from "@google-cloud/firestore";
import { BASE_URL, callStudio, client, getConferenceTwimlForPhone, saveRevealHelper, sendSms, TWILIO_NUMBER } from "./twilio";
import { createMatchFirestore, processAvailabilityCsv, processBulkSmsCsv, processMatchCsv } from "./csv";
import { Firestore, IMatch, IUser } from "./firestore";
import { flakeApology, flakeWarning, reminder } from "./smsCopy";
import { bipartite, generateAvailableMatches, generateRemainingMatchCount } from "./remainingMatches";
import { sendConfirmationEmail} from "./sendgrid"

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
 * Used by the frontend to look up metadata for a user based on username (e.g. when navigating to storydating.com/grace).
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
        "bc7dad0e-d1ee-42d5-b9b0-4b15b5d1b102": "firstName",
        "e9ad7465-f6cf-457f-8679-ff188616e43e": "lastName",
        "6fa1f2c6-a197-4509-bd40-561be56369ae": "age",
        "2a7363b5-ef3d-409d-9a4b-7e673ac70cb5": "gender",
        "c0e58906-8dc5-4471-a528-8e2290186ef0": "race",
        "b67c3eee-a90d-4302-a710-6556829b6817": "email",
        "6775fb10-e9a5-4ea6-909a-c939fed72695": "location",
        "ff785a0b-f3a0-4406-aa13-ea266e9bb2d7": "locationFlexibility",
        "3a3112de-77a8-40e8-bce8-3f7fec4bb6dd": "matchMin",
        "f88f7eef-745f-415d-8675-307965e200d6": "matchMax",
        "a5199299-4665-4e9b-87c7-eac644077f28": "phone",
        "1cb2d597-5a52-406b-bc12-45bdea0d877f": "genderPreference",
        "34932f3b-5120-47c2-8053-1c61c3f5ff6f": "funFacts",
        "ead263db-6980-4ebe-9bc4-2956ce894fd3": "interests",
        "4cef01ee-ed52-48b4-8f2b-902d38dafcf0": "social",
        "1b6b3940-ba10-46f3-bd8b-17b7f32e93f8": "whereDidYouHearAboutStory"
    }

    const user: { [key: string]: any } = {
        "referrer": req.body.form_response.hidden.r,
        "signUpDate": req.body.form_response.submitted_at
    }

    const answers = req.body.form_response.answers;
    console.log(answers);

    for (const a of answers) {
        const refff: string = a.field.ref;
        const key = answersIdMap[refff];
        if (!key) {
            continue;
        }
        if (a.type === 'text' || a.type === "boolean" || a.type === "email" || a.type === 'number' || a.type === 'phone_number' || a.type === 'long_text' || a.type === 'short_text') {
            user[key] = a[a.type];
        } else if (a.type === 'choice') {
            user[key] = a.choice.label ? a.choice.label : a.choice.other
        } else if (a.type === 'choices') {
            user[key] = a.choices.labels;
        }
    }

    user.phone = user.phone.split(" ").join("");
    if (user.location === "San Francisco Bay Area") {
        user.timezone = "PT";
    } else if (user.location === "New York City") {
        user.timezone = "ET";
    }

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
    await sendConfirmationEmail(user);

    response.end();
});

/** Used in each round to determine which users should be included (based on number of potential matches). */
export const generateRemainingMatchReport = functions.https.onRequest(
    async (request, response) => {
        const result = await generateRemainingMatchCount(request.body.excludeNames || []);
        response.send(result);
    });

/** Used in each round after obtaining availability to generate matches. */
export const generateMatchesUsingAvailability = functions.https.onRequest(
    async (request, response) => {
        const result = await generateAvailableMatches(request.body.schedulingView, request.body.tz);
        response.send(result);
    });

export const bipartiteAvailability = functions.https.onRequest(
    async (request, response) => {
        const result = await bipartite(request.body.schedulingView, request.body.tz);
        response.send(result);
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
    await processBulkSmsCsv(tempFilePath, sendSms)
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
    await processAvailabilityCsv(tempFilePath, new Firestore(), sendSms);
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

    await processMatchCsv(tempFilePath, new Firestore(), sendSms);
});

export const createMatch = functions.https.onRequest(
    async (request, response) => {
        const match = await createMatchFirestore(request.body, new Firestore())
        response.send(match);
    });

export const cancelMatch = functions.https.onRequest(
    async (request, response) => {
        await admin.firestore().collection("matches").doc(request.body.id).update("canceled", true);
        response.end();
    });

// runs every hour
export const sendReminderTexts = functions.pubsub.schedule('0,30 * * * *').onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour").add(1, "hour");
    if (moment().minutes() >= 30) {
        createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async txn => {
        const matches = await txn.get(admin.firestore()
            .collection("matches")
            .where("created_at", "==", createdAt)
            .where("reminded", "==", false)
            .where("canceled", "==", false));
        console.log("found the following matches: " + matches.docs.map(doc => doc.id));

        const userAIds = matches.docs.map(doc => doc.get("user_a_id"));
        const userBIds = matches.docs.map(doc => doc.get("user_b_id"));
        const userIds = userAIds.concat(userBIds);
        console.log("sending texts to the following users: " + userIds);

        if (userIds.length === 0) {
            return;
        }
        const users = await txn.getAll(...userIds.map(id => admin.firestore().collection("users").doc(id)));

        const usersById = Object.assign({}, ...users.map(user => ({ [user.id]: user.data() })));

        const allPromises: Array<Promise<any>> = []
        matches.docs.forEach(doc => {
            const userA = usersById[doc.get("user_a_id")];
            const userB = usersById[doc.get("user_b_id")];
            allPromises.push(textUserHelper(userA, userB))
            allPromises.push(textUserHelper(userB, userA))
        })

        await Promise.all(allPromises);
        await Promise.all(matches.docs.map(doc => txn.update(doc.ref, "reminded", true)))
    })
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
export const issueCalls = functions.pubsub.schedule('0,30 * * * *').onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() >= 30) {
        createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async txn => {
        const matches = await txn.get(admin
            .firestore()
            .collection("matches")
            .where("created_at", "==", createdAt)
            .where("called", "==", false)
            .where("canceled", "==", false));
        console.log("found the following matches: " + matches.docs.map(doc => doc.id));

        const userAIds = matches.docs.map(doc => doc.get("user_a_id"));
        const userBIds = matches.docs.map(doc => doc.get("user_b_id"));
        const userIds = userAIds.concat(userBIds);
        console.log("issuing calls to the following users: " + userIds);

        await Promise.all(userIds.map(id => callUserHelper(id)));
        await Promise.all(matches.docs.map(doc => txn.update(doc.ref, "called", true)))
    })
});

export const handleFlakes = functions.pubsub.schedule('10,40 * * * *').onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() >= 30) {
        createdAt.add(30, "minutes");
    }
    await admin.firestore().runTransaction(async txn => {
        const matches = await txn.get(admin
            .firestore()
            .collection("matches")
            .where("created_at", "==", createdAt)
            .where("flakesHandled", "==", false)
            .where("canceled", "==", false));
        console.log("found the following matches: " + matches.docs.map(doc => doc.id));

        const flakeMatches = matches.docs
            .map(doc => doc.data() as IMatch)
            .filter(m => Object.keys(m.joined || {}).length !== 2);
        console.log("found the following flaked matches: " + flakeMatches.map(m => m.id));

        const users = await new Firestore().getUsersForMatches(flakeMatches)
        const smsPromises: Array<Promise<any>> = [];
        flakeMatches.forEach(m => {
            m.user_ids.forEach(userId => {
                const user = users[userId];
                const other = userId === m.user_a_id ? users[m.user_b_id] : users[m.user_a_id];
                const body = userId in (m.joined || {}) ? flakeApology(user, other) : flakeWarning(user, other);
                smsPromises.push(sendSms({
                    body,
                    from: TWILIO_NUMBER,
                    to: user.phone,
                }));
            })
        })
        await Promise.all(smsPromises);
        await Promise.all(matches.docs.map(doc => txn.update(doc.ref, "flakesHandled", true)));
    })
});

export const callStudioManual = functions.https.onRequest(
    async (request, response) => {
        const matchId = request.body.matchId;
        const match = await admin
            .firestore()
            .collection("matches")
            .doc(matchId)
            .get();
        await callStudio(request.body.mode, match.data() as IMatch, new Firestore());
        response.end();
    });

export const revealRequest = functions.pubsub.schedule('0,30 * * * *').onRun(async (context) => {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() < 30) {
        createdAt.subtract(30, "minutes");
    }
    await admin.firestore().runTransaction(async txn => {
        const matches = await txn.get(admin
            .firestore()
            .collection("matches")
            .where("created_at", "==", createdAt)
            .where("revealRequested", "==", false));
        const connectedMatches = matches.docs.filter(doc => doc.get("twilioSid") !== undefined);
        await Promise.all(connectedMatches.map(async doc => {
            await playCallOutro(doc.data() as IMatch, doc.get("twilioSid"));
            txn.update(doc.ref, "revealRequested", true);
        }));
    });
});

async function playCallOutro(match: IMatch, conferenceSid: string) {
    try {
        // wrap in try/catch as twilio will throw if the conference has already ended
        const participants = await client.conferences(conferenceSid).participants.list();
        await Promise.all(participants.map(participant =>
            client.conferences(conferenceSid).participants(participant.callSid).update({ muted: true })))
        await client.conferences(conferenceSid).update({ announceUrl: BASE_URL + "callOutro" })
        await util.promisify(setTimeout)(27_000);
        await client.conferences(conferenceSid).update({ status: "completed" })
    } catch (err) {
        console.log(err);
    }
    await callStudio("reveal_request", match, new Firestore());
}

export const saveReveal = functions.https.onRequest(
    async (request, response) => {
        const res = await saveRevealHelper(request.body, new Firestore());
        if (res) {
            response.send(res);
        } else {
            response.end();
        }
    });


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
            from: "+12036338466",
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
        gather.play("https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_screen.mp3?alt=media");

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
            await client.conferences(conferenceSid).update({ announceUrl: BASE_URL + "announceUser" })
            await util.promisify(setTimeout)(28_000);
            await Promise.all(participants.map(participant =>
                client.conferences(conferenceSid).participants(participant.callSid).update({ muted: false })))
        } else if (request.body.StatusCallbackEvent === "conference-end") {
            await admin.firestore().collection("matches").doc(request.body.FriendlyName)
                .update({ "ongoing": false })
        }
        response.end();
    }
);

export const announceUser = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.play("https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_intro.mp3?alt=media");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const announce5Min = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.play("https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const announce1Min = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.play("https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fbell.mp3?alt=media");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

export const callOutro = functions.https.onRequest(
    (request, response) => {
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.play("https://firebasestorage.googleapis.com/v0/b/speakeasy-prod.appspot.com/o/callSounds%2Fstory_outro.mp3?alt=media");
        response.set('Content-Type', 'text/xml');
        response.send(twiml.toString());
    }
);

// runs every hour at 25 minutes past
export const call5MinWarning = functions.pubsub.schedule('25,55 * * * *').onRun(async (context) => {
    await admin.firestore().runTransaction(async txn => {
        const ongoingCalls = await txn.get(admin
            .firestore()
            .collection("matches")
            .where("ongoing", "==", true)
            .where("warned5Min", "==", false));
        await Promise.all(ongoingCalls.docs.map(doc =>
            client.conferences(doc.get("twilioSid"))
                .update({ announceUrl: BASE_URL + "announce5Min" })));
        await Promise.all(ongoingCalls.docs.map(doc => txn.update(doc.ref, "warned5Min", true)));
    });
});

// runs every hour at 29 minutes past
export const call1MinWarning = functions.pubsub.schedule('29,59 * * * *').onRun(async (context) => {
    // wait 30s
    await util.promisify(setTimeout)(30_000);
    await admin.firestore().runTransaction(async txn => {
        const ongoingCalls = await txn.get(admin
            .firestore()
            .collection("matches")
            .where("ongoing", "==", true)
            .where("warned1Min", "==", false));
        await Promise.all(ongoingCalls.docs.map(doc =>
            client.conferences(doc.get("twilioSid"))
                .update({ announceUrl: BASE_URL + "announce1Min" })));
        await Promise.all(ongoingCalls.docs.map(doc => txn.update(doc.ref, "warned1Min", true)));
    });
});

export const backupFirestore = functions.pubsub.schedule('every 24 hours').onRun((context) => {
    const fClient = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const databaseName = fClient.databasePath(projectId, '(default)');

    const outputUriPrefix = "gs://" + admin.storage().bucket().name + "/backups/" + moment().format("YYYY-MM-DD");
    console.log("backing up to " + outputUriPrefix);
    return fClient.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        collectionIds: [] // leave collectionIds empty to export all collections
    });
});
