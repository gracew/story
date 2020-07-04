// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

admin.initializeApp();

export const registerUser = functions.https.onCall(
  async (request) => {
    // TODO(gracew): normalize phone number, make sure it hasn't already been registered
    const ref = admin.firestore().collection("users").doc();
    const user = { ...request, id: ref.id };
    await ref.set(user);
    return user;
  }
);

export const optIn = functions.https.onRequest(
    async (request, response) => {
        const phone_number = request.body.phone_number;
        const users = admin.firestore().collection("users");
        const result = await users.where("phone_number", "==", phone_number).get();

        if (result.empty) {
            console.log("ERROR | No user with phone number " + phone_number);
            response.send({success: false, message: "User does not exist"});
        } else {
            console.log("Opting in user with phone number " + phone_number);
            const user_id = result.docs[0].id;

            await admin.firestore().collection("optIns").doc().set({
                user_id: user_id,
                created_at: Date.now()
            })
            response.send({success: true});
        }
    }
)

export const reveal = functions.https.onRequest(
    async (request, response) => {
        const match_id = request.body.match_id;
        const phone_number = request.body.phone_number;
        
        const match_doc_ref = admin.firestore().collection("matches").doc(match_id);
        const match_doc = await match_doc_ref.get();
        if (!match_doc.exists) {
            console.log("ERROR | No match with id " + match_id);
            response.send({success: false, message: "Match does not exist"});
        } else {
            const users = await admin.firestore().collection("users");

            const user_a_query = await users.where("phone_number", "==", phone_number).get();
            console.log(user_a_query);

            // check if user exists in table
            if (user_a_query.empty) {
                console.log("ERROR | User does not exist");
                response.send({success: false, message: "User does not exist"});
            }

            const user_a_id = user_a_query.docs[0].id;
            console.log("Reveailing user id " + user_a_id);


            if (match_doc.data().user_a_id == user_a_id) {
                match_doc_ref.update({user_a_revealed: true});
                response.send({success: true});
            } else if (match_doc.data().user_b_id == user_a_id) {
                match_doc_ref.update({user_b_revealed: true});
                response.send({success: true});
            } else {
                // match doesn't have the users in request
                console.log("ERROR | Requested match doesnt have the requested users ");
                response.send({success: false, message: "Requested match doesnt have the requested users"});
            }
        }
    }
)

export const getUsers = functions.https.onRequest(
  async (request, response) => {
    const users = await admin.firestore().collection("users").get();
    
    response.send(users.docs.map((user) => user.id ));
  }
);