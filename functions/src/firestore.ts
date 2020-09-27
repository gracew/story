import * as admin from "firebase-admin";
import * as moment from "moment";

export interface IMatch {
    user_a_id: string;
    user_b_id: string;
    user_ids: string[];
    created_at: Date;
}

export class Firestore {
    public getUser(id: string) {
        return admin.firestore().collection("users").doc(id).get();
    }

    public createMatch(match: IMatch) {
        return admin.firestore().collection("matches").doc().set(match);
    }
}

export async function matchesThisHour() {
    return await admin
        .firestore()
        .collection("matches")
        .where("created_at", "==", moment().utc().startOf("hour"))
        .get();
}