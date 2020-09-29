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
};

export function user(firstName: string): IUser {
    return {
        id: uuid.v4(),
        firstName,
        phone: uuid.v4(),
    }
}

export function match(userIdA: string, userIdB: string, createdAt: string): IMatch {
    return {
        id: uuid.v4(),
        user_a_id: userIdA,
        user_b_id: userIdB,
        user_ids: [userIdA, userIdB],
        created_at: new Date(createdAt),
    }
}