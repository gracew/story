
import * as functions from "firebase-functions";
import { Firestore } from "./firestore";
import { analyzeCollection as analyzeCollectionHelper } from "./validateMatches2";

export const createMatch = functions.https.onRequest(
  async (request, response) => {
    const match = await new Firestore().createMatch(request.body);
    response.send(match);
  }
);

export const analyzeCollection = functions.https.onRequest(
  async (req, response) => {
    const analysis = await analyzeCollectionHelper(req.body.collectionName);
    response.send(analysis);
  }
);
