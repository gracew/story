import * as admin from "firebase-admin";

export interface IUser {
    id: string;
    firstName: string;
    phone: string;
    location: string;
    locationFlexibility?: boolean;
    funFacts?: string;
}
export interface IMatch {
    id: string;
    user_a_id: string;
    user_a_revealed?: boolean;
    user_b_id: string;
    user_b_revealed?: boolean;
    user_ids: string[];
    joined?: Record<string, boolean>,
    created_at: admin.firestore.Timestamp;
    canceled?: boolean;
    reminded?: boolean;
    called?: boolean;
    flakesHandled?: boolean;
    warned5Min?: boolean;
    warned1Min?: boolean;
    revealRequested?: boolean;
    mode?: string;
}

export class Firestore {
    public async getUser(id: string): Promise<IUser | undefined> {
        const user = await admin.firestore().collection("users").doc(id).get();
        return user.data() as IUser | undefined;
    }

    public async getUserByPhone(phone: string): Promise<IUser | undefined> {
        const users = await admin.firestore().collection("users");
        const user = await users.where("phone", "==", phone).get();
        if (user.empty) {
            return;
        }
        return user.docs[0].data() as IUser;
    }

    public async getMatch(id: string): Promise<IMatch | undefined> {
        const match = await admin.firestore().collection("matches").doc(id).get();
        return match.data() as IMatch | undefined;
    }

    public createMatch(match: Partial<IMatch>) {
        const ref = admin.firestore().collection("matches").doc()
        return ref.set({ ...match, id: ref.id });
    }

    public updateMatch(id: string, update: Partial<IMatch>) {
        return admin.firestore().collection("matches").doc(id).update(update);
    }

    public async latestMatchForUser(id: string): Promise<IMatch | undefined> {
        const latestMatchOther = await admin.firestore().collection("matches")
            .where("user_ids", "array-contains", id)
            .orderBy("created_at", "desc")
            .limit(1)
            .get();
        return latestMatchOther.empty ? undefined : latestMatchOther.docs[0].data() as IMatch;
    }

    public async getUsersForMatches(matches: IMatch[]): Promise<Record<string, IUser>> {
        if (matches.length === 0) {
            return {};
        }

        const userARefs = matches.map(m => admin.firestore().collection("users").doc(m.user_a_id));
        const userBRefs = matches.map(m => admin.firestore().collection("users").doc(m.user_b_id));

        const allUsers = await admin.firestore().getAll(...userARefs.concat(userBRefs));
        return Object.assign({}, ...allUsers.map(user => ({ [user.id]: user.data() })));
    }

    public async createSchedulingRecords(week: string, userIds: string[]) {
        const batch = admin.firestore().batch();
        userIds.forEach(userId => {
            batch.create(admin.firestore().collection("scheduling").doc(week).collection("users").doc(userId), {});
        })
        return batch.commit();
    }
}
