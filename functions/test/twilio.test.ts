import * as test from "firebase-functions-test";
// WARNING: this must come first or else imported modules may not see this config value on load
test().mockConfig({ twilio: { auth_token: "token" } });
import * as uuid from "uuid";
import { IMatch, IUser, NotifyRevealMode } from "../src/firestore";
import { callStudio, saveRevealHelper, TWILIO_NUMBER } from "../src/twilio";
import { firestore, match, user } from "./mock";

const mockCreate = jest.fn();
jest.mock("twilio", () => {
    return jest.fn().mockImplementation(() => {
        return {
            studio: {
                flows() { return { executions: { create: mockCreate } } }
            }
        };
    })
});


let user1: IUser;
let user2: IUser;
let user3: IUser;
let m1: IMatch;
let m2: IMatch;

beforeEach(() => {
    user1 = user(uuid.v4());
    user2 = user(uuid.v4());
    user3 = user(uuid.v4());
    m1 = match(user1.id, user2.id, "2020-09-23T20:00:00-04:00"); // Wed
    m2 = match(user3.id, user2.id, "2020-09-24T20:00:00-04:00"); // Thu

    jest.resetAllMocks();
    firestore.getUserByPhone.mockResolvedValue(user1);
    firestore.getMatch.mockResolvedValue(m1);
    firestore.getUser.mockImplementation(id => {
        if (id === user1.id) {
            return user1;
        } else if (id === user2.id) {
            return user2;
        } else if (id === user3.id) {
            return user3;
        }
        return undefined;
    });
    firestore.nextMatchForUser.mockImplementation(id => {
        if (id === user2.id) {
            return m2;
        }
        return undefined;
    });
});

it("callStudio", async () => {
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    await callStudio("reveal_request", m1, firestore, false);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith({
        to: user1.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal_request",
            userId: user1.id,
            matchId: m1.id,
            firstName: user1.firstName,
            matchName: user2.firstName,
            matchPhone: user2.phone,
            matchUserId: user2.id,
            photo: "self_no_photo",
            video: false,
        }
    });
    expect(mockCreate).toHaveBeenCalledWith({
        to: user2.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal_request",
            userId: user2.id,
            matchId: m1.id,
            firstName: user2.firstName,
            matchName: user1.firstName,
            matchPhone: user1.phone,
            matchUserId: user1.id,
            nextMatchName: user3.firstName,
            nextMatchDate: "Thursday",
            photo: "self_no_photo",
            video: false,
        }
    });
});

it("callStudio - userA photo", async () => {
    user1.photo = "photoUrl";
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    await callStudio("reveal_request", m1, firestore, false);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].parameters.photo).toEqual("other_no_photo");
    expect(mockCreate.mock.calls[1][0].parameters.photo).toEqual("self_no_photo");
});

it("callStudio - userB photo", async () => {
    user2.photo = "photoUrl";
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    await callStudio("reveal_request", m1, firestore, false);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].parameters.photo).toEqual("self_no_photo");
    expect(mockCreate.mock.calls[1][0].parameters.photo).toEqual("other_no_photo");
});

it("callStudio - both photo", async () => {
    user1.photo = "photoUrl";
    user2.photo = "photoUrl";
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    await callStudio("reveal_request", m1, firestore, false);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].parameters.photo).toEqual("both_photo");
    expect(mockCreate.mock.calls[1][0].parameters.photo).toEqual("both_photo");
});

it("saveReveal Y, other pending", async () => {
    const res = await saveRevealHelper(user1, m1, true, firestore);
    expect(res).toEqual({ next: "reveal_other_pending" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { [`revealed.${user1.id}`]: true });
});

it("saveReveal Y, other N", async () => {
    m1.revealed[user2.id] = false;
    const res = await saveRevealHelper(user1, m1, true, firestore);
    expect(res).toEqual({ next: "reveal_other_no" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { [`revealed.${user1.id}`]: true });
});

it("saveReveal Y, other Y next match", async () => {
    m1.revealed[user2.id] = true;
    const res = await saveRevealHelper(user1, m1, true, firestore);
    expect(res).toEqual({ next: "reveal" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { [`revealed.${user1.id}`]: true });
    expect(firestore.createNotifyRevealJob).toHaveBeenCalledTimes(2);
    expect(firestore.createNotifyRevealJob).toHaveBeenCalledWith({ 
        matchId: m1.id, 
        notifyUserId: user1.id, 
        mode: NotifyRevealMode.REVEAL,
    });
    expect(firestore.createNotifyRevealJob).toHaveBeenCalledWith({ 
        matchId: m1.id, 
        notifyUserId: user2.id, 
        mode: NotifyRevealMode.REVEAL,
    });
});

it("saveReveal N", async () => {
    const res = await saveRevealHelper(user1, m1, false, firestore);
    expect(res).toEqual({ next: "no_reveal" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { [`revealed.${user1.id}`]: false });
});

it("saveReveal N, other Y next match", async () => {
    m1.revealed[user2.id] = true;
    const res = await saveRevealHelper(user1, m1, false, firestore);
    expect(res).toEqual({ next: "no_reveal" })
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { [`revealed.${user1.id}`]: false });
    expect(firestore.createNotifyRevealJob).toHaveBeenCalledTimes(1);
    expect(firestore.createNotifyRevealJob).toHaveBeenCalledWith({ 
        matchId: m1.id, 
        notifyUserId: user2.id,
        mode: NotifyRevealMode.REVEAL_OTHER_NO,
    });
});
