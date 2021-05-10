import admin = require("firebase-admin");
import * as moment from "moment";
import * as uuid from "uuid";
import { IMatch, IUser } from "../src/firestore";

export const firestore = {
  upcomingMatchesForUser: jest.fn(),
  setPreferences: jest.fn(),
  saveUser: jest.fn(),
  getOrCreateUser: jest.fn(),
  getUser: jest.fn(),
  createMatch: jest.fn(),
  getUsersForMatches: jest.fn(),
  getUserByPhone: jest.fn(),
  getMatch: jest.fn(),
  rescheduleMatch: jest.fn(),
  updateMatch: jest.fn(),
  cancelMatch: jest.fn(),
  currentMatchForUser: jest.fn(),
  nextMatchForUser: jest.fn(),
  createSchedulingRecords: jest.fn(),
  getSchedulingRecords: jest.fn(),
};

export function user(firstName: string, other?: Partial<IUser>): IUser {
  return {
    id: uuid.v4(),
    onboardingComplete: true,
    firstName,
    gender: "Female",
    genderPreference: "Women",
    age: 30,
    matchMin: 20,
    matchMax: 40,
    phone: uuid.v4(),
    beta: true,
    location: "San Francisco Bay Area",
    timezone: "PT",
    ...other,
  };
}

export function match(
  userIdA: string,
  userIdB: string,
  createdAt: string,
  other?: Partial<IMatch>
): IMatch {
  return {
    id: uuid.v4(),
    user_a_id: userIdA,
    user_b_id: userIdB,
    user_ids: [userIdA, userIdB],
    joined: {},
    revealed: {},
    created_at: new admin.firestore.Timestamp(moment(createdAt).unix(), 0),
    canceled: false,
    interactions: {
      notified: false,
      reminded: false,
      called: false,
      recalled: false,
      flakesHandled: false,
      warned5Min: false,
      warned1Min: false,
      revealRequested: false,
    },
    mode: "phone",
    ...other,
  };
}
