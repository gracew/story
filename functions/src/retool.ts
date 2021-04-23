import * as functions from "firebase-functions";
import { CreateMatchInput, Firestore } from "./firestore";
import { analyzeCollection as analyzeCollectionHelper } from "./validateMatches2";

// TODO: add a match response for API
// possibly validate that the match time is allowed?
export const createMatch = functions.https.onRequest(
  async ({ body }: { body: CreateMatchInput }, response) => {
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
