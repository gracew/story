
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {createMatchFirestore, CreateMatchParams} from "./csv";
import { Firestore } from "./firestore";
import { analyzeCollection as analyzeCollectionHelper } from "./validateMatches2";

export const createMatch = functions.https.onRequest(
  async ({body}: {body: CreateMatchParams}, response) => {
    const match = await createMatchFirestore(body, new Firestore());
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

export const analyzeCollection = functions.https.onRequest(
  async (req, response) => {
    const analysis = await analyzeCollectionHelper(req.body.collectionName);
    response.send(analysis);
  }
);
