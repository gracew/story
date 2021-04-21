import * as admin from "firebase-admin";
import moment = require("moment-timezone");

export interface ICalendarDate {
    year: number,
    month: number,
    day: number,
}

export interface IUser {
    id: string;
    firstName: string;
    phone: string;
    gender: string;
    genderPreference: string;
    age: number | string;
    matchMin: number;
    matchMax: number;
    location: string;
    timezone: string;
    locationFlexibility?: boolean;
    funFacts?: string;
    status?: string;
    photo?: string;
    beta?: boolean;
    // fields from onboarding
    whereDidYouHearAboutUs?: string,
    birthdate?: ICalendarDate,
    pronouns?: string,
    interests?: string,
    social?: string,
    /** A value of undefined is equivalent to true (these are users who signed up through typeform). */
    onboardingComplete?: boolean;
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
    interactions: {
        notified?: boolean;
        reminded?: boolean;
        called?: boolean;
        recalled?: boolean;
        flakesHandled?: boolean;
        warned5Min?: boolean;
        warned1Min?: boolean;
        revealRequested?: boolean;
        // if both respond Y to the phone call, have we notified both users of the next step
        nextStepHandled?: boolean;  
    },
    mode?: string;

    // used for phone matches
    twilioSid?: string;
    recordingOverride?: boolean;
    ongoing?: boolean;  // whether at least 1  person is on the call

    // used for video matches
    videoId?: string;
    videoLink?: string;
    videoPasscode?: string;
    videoAvailability?: Record<string, any>;
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

    public async currentMatchForUser(id: string): Promise<IMatch | undefined> {
        const createdAt = moment().utc().startOf("hour");
        if (moment().minutes() >= 30) {
            createdAt.add(30, "minutes");
        }
        const match = await admin.firestore().collection("matches")
            .where("user_ids", "array-contains", id)
            .where("created_at", "==", createdAt)
            .where("canceled", "==", false)
            .get();
        return match.empty ? undefined : match.docs[0].data() as IMatch;
    }

    public async nextMatchForUser(id: string): Promise<IMatch | undefined> {
        const latestMatchOther = await admin.firestore().collection("matches")
            .where("user_ids", "array-contains", id)
            .where("canceled", "==", false)
            .where("created_at", ">=", new Date())
            .orderBy("created_at", "asc")
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
        const data = {
            interactions: {
                requested: false,   // we requested the user's availability
                responded: false,   // the user provided their availability
                reminded: false,
            },
        }
        userIds.forEach(userId => {
            batch.create(admin.firestore().collection("scheduling").doc(week).collection("users").doc(userId), data);
        })
        return batch.commit();
    }
}
