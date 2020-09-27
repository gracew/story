import * as admin from "firebase-admin";
import * as moment from "moment";

export interface IUser {
    firstName: string;
    phone: string;
    funFacts?: string;
}
export interface IMatch {
    user_a_id: string;
    user_b_id: string;
    user_ids: string[];
    created_at: Date;
}

export class Firestore {
    public async getUser(id: string): Promise<IUser | undefined> {
        const user = await admin.firestore().collection("users").doc(id).get();
        return user.data() as IUser | undefined;
    }

    public createMatch(match: IMatch) {
        return admin.firestore().collection("matches").doc().set(match);
    }

    public async matchesThisWeek(): Promise<IMatch[]> {
        const result = await admin.firestore().collection("matches")
            .where("created_at", ">=", moment().utc().startOf("week"))
            .get();
        return result.docs.map(doc => doc.data() as IMatch);
    }
    
    public async getUsersForMatches(matches: IMatch[]): Promise<Record<string, IUser>> {
        const userARefs = matches.map(m => admin.firestore().collection("users").doc(m.user_a_id));
        const userBRefs = matches.map(m => admin.firestore().collection("users").doc(m.user_b_id));

        const allUsers = await admin.firestore().getAll(...userARefs.concat(userBRefs));
        return Object.assign({}, ...allUsers.map(user => ({ [user.id]: user.data() })));
    }
}

export async function matchesThisHour() {
    return await admin
        .firestore()
        .collection("matches")
        .where("created_at", "==", moment().utc().startOf("hour"))
        .get();
}