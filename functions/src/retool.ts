
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createMatchFirestore } from "./csv";
import { Firestore } from "./firestore";

export const createMatch = functions.https.onRequest(
  async (request, response) => {
    const match = await createMatchFirestore(request.body, new Firestore());
    response.send(match);
  }
);

export const cancelMatch = functions.https.onRequest(
  async (request, response) => {
    await admin
      .firestore()
      .collection("matches")
      .doc(request.body.id)
      .update("canceled", true);
    response.end();
  }
);
