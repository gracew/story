import * as test from "firebase-functions-test";
// WARNING: this must come first or else imported modules may not see this config value on load
test().mockConfig({ twilio: { auth_token: "token" } });
import * as uuid from "uuid";
import { IMatch, IUser } from "../src/firestore";
import { callStudio, getNextDays, saveRevealHelper, TWILIO_NUMBER } from "../src/twilio";
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
const today = "Wednesday";
const nextWeek = "Friday, Saturday, Sunday";

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
    await callStudio("reveal_request", m1, firestore, false, "Wednesday");
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
            matchPhone: user2.phone.substring(2),
            matchUserId: user2.id,
            photo: "self_no_photo",
            nextDays: nextWeek,
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
            matchPhone: user1.phone.substring(2),
            matchUserId: user1.id,
            nextMatchName: user3.firstName,
            nextMatchDate: "Thursday",
            nextDays: nextWeek,
            photo: "self_no_photo",
            video: false,
        }
    });
});

it("callStudio - userA photo", async () => {
    user1.photo = "photoUrl";
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    await callStudio("reveal_request", m1, firestore, false, "Wednesday");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].parameters.photo).toEqual("other_no_photo");
    expect(mockCreate.mock.calls[1][0].parameters.photo).toEqual("self_no_photo");
});

it("callStudio - userB photo", async () => {
    user2.photo = "photoUrl";
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    await callStudio("reveal_request", m1, firestore, false, "Wednesday");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].parameters.photo).toEqual("self_no_photo");
    expect(mockCreate.mock.calls[1][0].parameters.photo).toEqual("other_no_photo");
});

it("callStudio - both photo", async () => {
    user1.photo = "photoUrl";
    user2.photo = "photoUrl";
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    await callStudio("reveal_request", m1, firestore, false, "Wednesday");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].parameters.photo).toEqual("both_photo");
    expect(mockCreate.mock.calls[1][0].parameters.photo).toEqual("both_photo");
});

it("saveReveal Y, other pending", async () => {
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "y", matchId: m1.id }, firestore, today);
    expect(res).toEqual({ next: "reveal_other_pending" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
});

it("saveReveal Y, other N", async () => {
    m1.user_b_revealed = false;
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "y", matchId: m1.id }, firestore, today);
    expect(res).toEqual({ next: "reveal_other_no" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
});

it("saveReveal Y, other Y next match", async () => {
    m1.user_b_revealed = true;
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "y", matchId: m1.id }, firestore, today);
    expect(res).toEqual({ next: "reveal" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        to: user2.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal",
            matchId: m1.id,
            userId: user2.id,
            firstName: user2.firstName,
            matchName: user1.firstName,
            matchPhone: user1.phone.substring(2),
            matchUserId: user1.id,
            nextMatchName: user3.firstName,
            nextMatchDate: "Thursday",
            nextDays: nextWeek,
            video: false,
        }
    })
});

it("saveReveal N", async () => {
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "n", matchId: m1.id }, firestore, today);
    expect(res).toEqual({ next: "no_reveal" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: false });
});

it("saveReveal N, other Y next match", async () => {
    m1.user_b_revealed = true;
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "n", matchId: m1.id }, firestore, today);
    expect(res).toEqual({ next: "no_reveal" })
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: false });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        to: user2.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal_other_no",
            matchId: m1.id,
            userId: user2.id,
            firstName: user2.firstName,
            matchName: user1.firstName,
            matchPhone: user1.phone.substring(2),
            matchUserId: user1.id,
            nextMatchName: user3.firstName,
            nextMatchDate: "Thursday",
            video: false,
        }
    })
});

it("saveReveal accepts a variety of inputs", async () => {
    const yesInputs = ["Y", "yes", "YES", "y ", " y"];
    for (const input of yesInputs) {
        firestore.updateMatch.mockReset();
        const res = await saveRevealHelper({ phone: user1.phone, reveal: input, matchId: m1.id }, firestore, today);
        expect(res).toEqual({ next: "reveal_other_pending" });
        expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
        expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
    }

    const noInputs = ["N", "no", "NO", "n ", " n"];
    for (const input of noInputs) {
        firestore.updateMatch.mockReset();
        const res = await saveRevealHelper({ phone: user1.phone, reveal: input, matchId: m1.id }, firestore, today);
        expect(res).toEqual({ next: "no_reveal" });
        expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
        expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: false });
    }
});

it("saveReveal does not save for unknown input", async () => {
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "foo", matchId: m1.id }, firestore, today);
    expect(res).toBeUndefined();
    expect(firestore.updateMatch).not.toHaveBeenCalled();
});

it("getNextDays", async () => {
    const tue = match(user1.id, user2.id, "2020-09-22T20:00:00-04:00");
    const wed = match(user1.id, user2.id, "2020-09-23T20:00:00-04:00");
    const thu = match(user3.id, user2.id, "2020-09-24T20:00:00-04:00");
    const fri = match(user3.id, user2.id, "2020-09-25T20:00:00-04:00");
    const sat = match(user3.id, user2.id, "2020-09-26T20:00:00-04:00");
    const sun = match(user3.id, user2.id, "2020-09-27T20:00:00-04:00");

    // if today is Tuesday: available latest match days are Tuesday, Wednesday, Thursday (other phone dates)
    expect(getNextDays("Tuesday", tue, tue)).toEqual("Wednesday, Thursday, Friday")
    expect(getNextDays("Tuesday", tue, wed)).toEqual("Thursday, Friday, Saturday")
    expect(getNextDays("Tuesday", tue, thu)).toEqual("Wednesday, Friday, Saturday")
    expect(getNextDays("Tuesday", wed, thu)).toEqual("Friday, Saturday, Sunday")

    expect(getNextDays("Wednesday", wed, wed)).toEqual("Thursday, Friday, Saturday")
    expect(getNextDays("Wednesday", wed, fri)).toEqual("Thursday, Saturday, Sunday")
    expect(getNextDays("Wednesday", wed, sat)).toEqual("Thursday, Friday, Sunday")
    expect(getNextDays("Wednesday", wed, sun)).toEqual("Thursday, Friday, Saturday")
    expect(getNextDays("Wednesday", thu, fri)).toEqual("Saturday, Sunday")
    expect(getNextDays("Wednesday", thu, sat)).toEqual("Friday, Sunday")
    expect(getNextDays("Wednesday", thu, sun)).toEqual("Friday, Saturday")

    expect(getNextDays("Thursday", thu, thu)).toEqual("Friday, Saturday, Sunday")
    expect(getNextDays("Thursday", thu, fri)).toEqual("Saturday, Sunday")
    expect(getNextDays("Thursday", thu, sat)).toEqual("Friday, Sunday")
    expect(getNextDays("Thursday", thu, sun)).toEqual("Friday, Saturday")
    expect(getNextDays("Thursday", fri, sat)).toEqual("Sunday")
    expect(getNextDays("Thursday", fri, sun)).toEqual("Saturday")
    expect(getNextDays("Thursday", sat, sun)).toEqual("Friday")
});