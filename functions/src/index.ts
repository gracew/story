// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as fs from 'fs';
import * as moment from 'moment';
import * as os from 'os';
import * as path from 'path';
import { callNumberWithTwiml, getConferenceTwimlForPhone } from "./twilio";

admin.initializeApp();

export const registerUser = functions.https.onCall(async (request) => {
    const { phone, ...other } = request;
    const normalizedPhone = phone.split(" ").join("");

    // make sure the phone number hasn't already been registered
    const existingUser = await admin
        .firestore()
        .collection("users")
        .where("phone", "==", normalizedPhone)
        .get();
    if (!existingUser.empty) {
        throw new functions.https.HttpsError(
            "already-exists",
            "phone number has already been registered"
        );
    }

    async function usernameAvailable(proposed: string) {
        const existingUsername = await admin
            .firestore()
            .collection("users")
            .where("username", "==", proposed)
            .get();
        console.log(existingUsername)
        return existingUsername.docs.length === 0;
    }
    function randomBetween1and100() {
        return Math.floor(Math.random() * 100);
    }

    // generate unique username/link
    let username = request.firstName.toLowerCase();
    while (!(await usernameAvailable(username))) {
        username = username + randomBetween1and100();
        // NOTE(gracew): this might go on forever if there are more than 100 people with this first name
    }

    const gender = request.referralGender === "m" ? "f" : "m";

    const ref = admin.firestore().collection("users").doc();
    const user = {
        id: ref.id,
        username,
        phone: normalizedPhone,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        gender,
        ...other,
    };
    await ref.set(user);
    return user;
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

export const callUser = functions.https.onCall(
    async (request) => {
        const ref = admin.firestore().collection("users").doc(request.user_id);
        const user_doc = await ref.get();
        const user_doc_data = user_doc.data()
        if (!user_doc.exists || !user_doc_data) {
            return { "error": "User does not exist!" };
        }
        const phone = user_doc_data.phone_number;
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
        const result = await users.where("phone_number", "==", phone_number).get();

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
        const match_doc = await match_doc_ref.get();
        const match_doc_data = match_doc.data();
        if (!match_doc.exists || !match_doc_data) {
            console.log("ERROR | No match with id " + match_id);
            response.send({ success: false, message: "Match does not exist" });
        } else {
            const users = await admin.firestore().collection("users");

            const user_a_query = await users.where("phone_number", "==", phone_number).get();
            console.log(user_a_query);

            // check if user exists in table
            if (user_a_query.empty) {
                console.log("ERROR | User does not exist");
                response.send({ success: false, message: "User does not exist" });
            }

            const user_a_id = user_a_query.docs[0].id;
            console.log("Reveailing user id " + user_a_id);


            if (match_doc_data.user_a_id === user_a_id) {
                await match_doc_ref.update({ user_a_revealed: true });
                response.send({ success: true });
            } else if (match_doc_data.user_b_id === user_a_id) {
                await match_doc_ref.update({ user_b_revealed: true });
                response.send({ success: true });
            } else {
                // match doesn't have the users in request
                console.log("ERROR | Requested match doesnt have the requested users ");
                response.send({ success: false, message: "Requested match doesnt have the requested users" });
            }
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
        const { firstName, dob, bio, gender } = user.docs[0].data();
        const age = moment().diff(moment(dob), "years")
        return { firstName, age, bio, gender };
    }
);
