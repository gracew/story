import * as uuid from "uuid";
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

const user1 = user(uuid.v4());
const user2 = user(uuid.v4());
const user3 = user(uuid.v4());
const m1 = match(user1.id, user2.id, "2020-09-23T20:00:00-04:00");
const m2 = match(user3.id, user2.id, "2020-09-24T20:00:00-04:00");

beforeEach(() => {
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
    firestore.latestMatchForUser.mockResolvedValue(m1);
});

it("callStudio", async () => {
    firestore.getUsersForMatches.mockReturnValue({ [user1.id]: user1, [user2.id]: user2 });
    firestore.latestMatchForUser.mockImplementation(id => {
        if (id === user1.id) {
            return m1;
        }
        if (id === user2.id) {
            return m2;
        }
        return undefined;
    });
    await callStudio("reveal_request", [m1], firestore);
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
            nextMatchName: user3.firstName,
            nextMatchDate: "Thursday",
        }
    });
});

it("saveReveal Y, other pending", async () => {
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "y", matchId: m1.id }, firestore);
    expect(res).toEqual({ next: "reveal_other_pending" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
});

it("saveReveal Y, other N", async () => {
    m1.user_b_revealed = false;
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "y", matchId: m1.id }, firestore);
    expect(res).toEqual({ next: "reveal_other_no" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
});

it("saveReveal Y, other Y", async () => {
    m1.user_b_revealed = true;
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "y", matchId: m1.id }, firestore);
    expect(res).toEqual({ next: "reveal" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        to: user2.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal",
            userId: user2.id,
            firstName: user2.firstName,
            matchName: user1.firstName,
            matchPhone: user1.phone.substring(2),
        }
    })
});

it("saveReveal Y, other Y next match", async () => {
    m1.user_b_revealed = true;
    firestore.latestMatchForUser.mockResolvedValue(m2)
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "y", matchId: m1.id }, firestore);
    expect(res).toEqual({ next: "reveal" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: true });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        to: user2.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal",
            userId: user2.id,
            firstName: user2.firstName,
            matchName: user1.firstName,
            matchPhone: user1.phone.substring(2),
            nextMatchName: user3.firstName,
            nextMatchDate: "Thursday",
        }
    })
});

it("saveReveal N", async () => {
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "n", matchId: m1.id }, firestore);
    expect(res).toEqual({ next: "no_reveal" });
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: false });
});

it("saveReveal N, other Y", async () => {
    m1.user_b_revealed = true;
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "n", matchId: m1.id }, firestore);
    expect(res).toEqual({ next: "no_reveal" })
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: false });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        to: user2.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal_other_no",
            userId: user2.id,
            firstName: user2.firstName,
            matchName: user1.firstName,
            matchPhone: user1.phone.substring(2),
        }
    })
});

it("saveReveal N, other Y next match", async () => {
    m1.user_b_revealed = true;
    firestore.latestMatchForUser.mockResolvedValue(m2)
    const res = await saveRevealHelper({ phone: user1.phone, reveal: "n", matchId: m1.id }, firestore);
    expect(res).toEqual({ next: "no_reveal" })
    expect(firestore.updateMatch).toHaveBeenCalledTimes(1);
    expect(firestore.updateMatch).toHaveBeenCalledWith(m1.id, { user_a_revealed: false });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        to: user2.phone,
        from: TWILIO_NUMBER,
        parameters: {
            mode: "reveal_other_no",
            userId: user2.id,
            firstName: user2.firstName,
            matchName: user1.firstName,
            matchPhone: user1.phone.substring(2),
            nextMatchName: user3.firstName,
            nextMatchDate: "Thursday",
        }
    })
});
