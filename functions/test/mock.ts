import admin = require("firebase-admin");
import * as moment from "moment";
import * as uuid from "uuid";
import { IMatch, IUser } from "../src/firestore";

export const firestore = {
    getUser: jest.fn(),
    createMatch: jest.fn(),
    getUsersForMatches: jest.fn(),
    getUserByPhone: jest.fn(),
    getMatch: jest.fn(),
    updateMatch: jest.fn(),
    latestMatchForUser: jest.fn(),
    createSchedulingRecords: jest.fn(),
};

export function user(firstName: string, funFacts?: string): IUser {
    return {
        id: uuid.v4(),
        firstName,
        phone: uuid.v4(),
        funFacts,
    }
}

export function match(userIdA: string, userIdB: string, createdAt: string): IMatch {
    return {
        id: uuid.v4(),
        user_a_id: userIdA,
        user_b_id: userIdB,
        user_ids: [userIdA, userIdB],
        joined: {},
        created_at: new admin.firestore.Timestamp(moment(createdAt).unix(), 0),
        canceled: false,
        reminded: false,
        called: false,
        flakesHandled: false,
        warned5Min: false,
        warned1Min: false,
        revealRequested: false,
        mode: "phone",
    }
}