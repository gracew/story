import * as functions from "firebase-functions";
import { Firestore } from "./firestore";
import { analyzeCollection as analyzeCollectionHelper } from "./validateMatches2";
import { Requests } from "../../api/functions";

// TODO: add a match response for API
// possibly validate that the match time is allowed?
export const createMatch = functions.https.onRequest(
  async ({ body }: { body: Requests.CreateMatch }, response) => {
    const match = await new Firestore().createMatch({
      ...body,
      time: new Date(body.time),
    });
    response.send(match);
  }
);

export const analyzeCollection = functions.https.onRequest(
  async (req, response) => {
    const analysis = await analyzeCollectionHelper(req.body.collectionName);
    response.send(analysis);
  }
);
