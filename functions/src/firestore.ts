import { Transaction } from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import moment = require("moment-timezone");

export interface ICalendarDate {
  year: number;
  month: number;
  day: number;
}

// TODO: i think we can unify IUser and IPreOnboarded user, keeping this the way it is for now for
// type safety and clarity
export type IPreOnboardedUser = Pick<
  IUser,
  | "id"
  | "phone"
  | "status"
  | "locationFlexibility"
  | "onboardingComplete"
  | "referrer"
>;

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
  whereDidYouHearAboutUs?: string;
  birthdate?: ICalendarDate;
  pronouns?: string;
  interests?: string;
  social?: string;
  referrer?: string;
  onboardingComplete: boolean;
}

// TODO: incomplete
export interface IPreferences {
  connectionType?: { value: string };
}

export interface IMatch {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_ids: string[];
  joined?: Record<string, boolean>;
  revealed: Record<string, boolean>;
  /* A map from user id to a score from 1-5 (inclusive). An entry with key X is user X's rating of their match. */
  ratings?: Record<string, number>;

  created_at: admin.firestore.Timestamp;
  canceled?: boolean;
  rescheduled?: boolean;
  interactions: {
    notified?: boolean;
    reminded?: boolean;
    remindedClose?: boolean;
    called?: boolean;
    recalled?: boolean;
    flakesHandled?: boolean;
    warned5Min?: boolean;
    warned1Min?: boolean;
    revealRequested?: boolean;
    // if both respond Y to the phone call, have we notified both users of the next step
    nextStepHandled?: boolean;
    // if an SMS chat was created, did we send an expiration warning after 7 days
    warnedSmsChatExpiration?: boolean;
  };
  mode?: "video" | "phone";

  // used for phone matches
  twilioSid?: string;
  recordingOverride?: boolean;
  ongoing?: boolean; // whether at least 1  person is on the call

  // used for video matches
  videoId?: string;
  videoLink?: string;
  videoPasscode?: string;
  videoAvailability?: Record<string, any>;

  // set if the users are connected in a text chat
  twilioChatSid?: string;
  twilioChatCreatedAt?: admin.firestore.Timestamp;

  interviewUserId?: string;
}

interface ISchedulingRecord {
  interactions: {
    reminded: boolean;
    requested: boolean;
    responded: boolean;
  };

  // the following fields are set if interactions.responded = true
  available?: admin.firestore.Timestamp[];
  matches?: number;
  skip?: boolean;
}

export interface CreateMatchInput {
  userAId: string;
  userBId: string;
  time: Date;
  canceled?: boolean;
  notified?: boolean;
  mode?: "video" | "phone";
}

export interface NotifyRevealJob {
  matchId: string;
  notifyUserId: string;
  mode: NotifyRevealMode;
}

export enum NotifyRevealMode {
  REVEAL = "reveal",
  REVEAL_OTHER_NO = "reveal_other_no",
}

export class Firestore {
  public async saveUser(user: IUser | IPreOnboardedUser): Promise<void> {
    await admin.firestore().collection("users").doc(user.id).update(user);
  }

  public async setPreferences(
    userId: string,
    prefs: IPreferences
  ): Promise<void> {
    await admin.firestore().collection("preferences").doc(userId).set(prefs);
  }

  public async getOrCreateUser(phone: string): Promise<IPreOnboardedUser> {
    const existingUser = await this.getUserByPhone(phone);
    if (existingUser) {
      return existingUser;
    }
    // create record
    const doc = admin.firestore().collection("users").doc();
    const data = {
      id: doc.id,
      phone,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      eligible: true,
      status: "waitlist",
      onboardingComplete: false,
      locationFlexibility: true,
    };
    await doc.create(data);
    return data;
  }

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

  // TODO: possibly prevent duplicates here?
  public async createMatch(params: CreateMatchInput): Promise<IMatch> {
    const userA = await this.getUser(params.userAId);
    const userB = await this.getUser(params.userBId);

    if (!userA) {
      throw new Error("unknown user id " + params.userAId);
    }
    if (!userB) {
      throw new Error("unknown user id " + params.userBId);
    }
    const ref = admin.firestore().collection("matches").doc();
    const match = {
      id: ref.id,
      user_a_id: params.userAId,
      user_b_id: params.userBId,
      user_ids: [params.userAId, params.userBId],
      revealed: {},
      joined: {},
      created_at: admin.firestore.Timestamp.fromDate(params.time),
      canceled: params.canceled || false,
      interactions: {
        notified: params.notified || false,
        remindedClose: false,
        reminded: false,
        called: false,
        recalled: false,
        flakesHandled: false,
        warned5Min: false,
        warned1Min: false,
        revealRequested: false,
      },
      mode: params.mode || "phone",
    };
    await ref.set(match);
    return match;
  }

  public async rescheduleMatch(id: string, newTime: Date) {
    return this.updateMatch(id, {
      rescheduled: true,
      created_at: admin.firestore.Timestamp.fromDate(newTime),
    });
  }

  public cancelMatch(id: string) {
    return admin
      .firestore()
      .collection("matches")
      .doc(id)
      .update("canceled", true);
  }

  public async currentMatchForUser(id: string): Promise<IMatch | undefined> {
    const createdAt = moment().utc().startOf("hour");
    if (moment().minutes() >= 30) {
      createdAt.add(30, "minutes");
    }
    const match = await admin
      .firestore()
      .collection("matches")
      .where("user_ids", "array-contains", id)
      .where("created_at", "==", createdAt)
      .where("canceled", "==", false)
      .get();
    return match.empty ? undefined : (match.docs[0].data() as IMatch);
  }

  // ordered by meeting time, ascended, where all matches have a meeting time after the start of the week
  public async thisWeeksMatchesForUser(userId: string): Promise<IMatch[]> {
    const querySnapshot = await admin
      .firestore()
      .collection("matches")
      .where("user_ids", "array-contains", userId)
      .where("canceled", "==", false)
      // created_at is actually their meeting time, not the time the record was created
      .where("created_at", ">=", moment().startOf("week").toDate())
      .orderBy("created_at", "asc")
      .get();
    return querySnapshot.docs.map((snap) => snap.data() as IMatch);
  }

  public async nextMatchForUser(userId: string): Promise<IMatch | undefined> {
    const querySnapshot = await admin
      .firestore()
      .collection("matches")
      .where("user_ids", "array-contains", userId)
      .where("canceled", "==", false)
      // created_at is actually their meeting time, not the time the record was created
      .where("created_at", ">=", new Date())
      .orderBy("created_at", "asc")
      .get();
    return querySnapshot.docs.map((snap) => snap.data() as IMatch)[0];
  }

  public async getUsersForMatches(
    matches: IMatch[]
  ): Promise<Record<string, IUser>> {
    if (matches.length === 0) {
      return {};
    }

    const userARefs = matches.map((m) =>
      admin.firestore().collection("users").doc(m.user_a_id)
    );
    const userBRefs = matches.map((m) =>
      admin.firestore().collection("users").doc(m.user_b_id)
    );

    const allUsers = await admin
      .firestore()
      .getAll(...userARefs.concat(userBRefs));
    return Object.assign(
      {},
      ...allUsers.map((user) => ({ [user.id]: user.data() }))
    );
  }

  // mostly the same as getUsersForMatches except works inside of a transaction
  public static async getUsersForMatchesInTxn(
    txn: Transaction,
    matches: IMatch[]
  ): Promise<Record<string, IUser>> {
    const userAIds = matches.map((m) => m.user_a_id);
    const userBIds = matches.map((m) => m.user_b_id);
    const userIds = userAIds.concat(userBIds);

    if (userIds.length === 0) {
      return {};
    }
    const users = await txn.getAll(
      ...userIds.map((id) => admin.firestore().collection("users").doc(id))
    );

    return Object.assign(
      {},
      ...users.map((user) => ({ [user.id]: user.data() }))
    );
  }

  public async createSchedulingRecords(week: string, userIds: string[]) {
    const batch = admin.firestore().batch();
    const data = {
      interactions: {
        requested: false, // we requested the user's availability
        responded: false, // the user provided their availability
        reminded: false,
      },
    };
    userIds.forEach((userId) => {
      batch.create(
        admin
          .firestore()
          .collection("scheduling")
          .doc(week)
          .collection("users")
          .doc(userId),
        data
      );
    });
    return batch.commit();
  }

  public async getSchedulingRecords(
    week: string,
    userIds: string[]
  ): Promise<Record<string, ISchedulingRecord>> {
    if (userIds.length === 0) {
      return {};
    }
    const userRefs = userIds.map((id) =>
      admin
        .firestore()
        .collection("scheduling")
        .doc(week)
        .collection("users")
        .doc(id)
    );
    const res = await admin.firestore().getAll(...userRefs);
    return Object.assign({}, ...res.map((doc) => ({ [doc.id]: doc.data() })));
  }

  // TODO: let's make this private to decouple callers from inner workings of firestore
  public updateMatch(id: string, update: Partial<IMatch>) {
    return admin.firestore().collection("matches").doc(id).update(update);
  }

  public updateMatchInTxn(
    txn: Transaction,
    id: string,
    update: Partial<IMatch>
  ) {
    return txn.update(admin.firestore().collection("matches").doc(id), update);
  }

  public createNotifyRevealJob(job: NotifyRevealJob) {
    return admin.firestore().collection("notifyRevealJobs").doc().set(job);
  }
}
