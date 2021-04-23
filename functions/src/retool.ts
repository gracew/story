import * as functions from "firebase-functions";
import { CreateMatchParams } from "./csv";
import { Firestore } from "./firestore";
import { analyzeCollection as analyzeCollectionHelper } from "./validateMatches2";

// TODO: add a match response for API
export const createMatch = functions.https.onRequest(
  async ({ body }: { body: CreateMatchParams }, response) => {
    const match = await new Firestore().createMatch(body);
    response.send(match);
  }
);

export const analyzeCollection = functions.https.onRequest(
  async (req, response) => {
    const analysis = await analyzeCollectionHelper(req.body.collectionName);
    response.send(analysis);
  }
);
