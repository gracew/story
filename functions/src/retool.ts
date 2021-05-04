import * as functions from "firebase-functions";
import { Requests } from "../../api/functions";
import { Firestore } from "./firestore";

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
