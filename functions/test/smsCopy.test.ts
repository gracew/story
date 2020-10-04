import * as uuid from "uuid";
import { matchNotification } from "../src/smsCopy";
import { match, user } from "./mock";

const userId1 = uuid.v4();
const userId2 = uuid.v4();
const userId3 = uuid.v4();
const expectedSimpleET = "Hi Anna, your match Grace has confirmed. At 8pm ET Wednesday, you’ll receive a phone call connecting you with your match. If you miss the call, you can call back. Afterwards, we’ll ask if you want to swap phone numbers. In the case of mutual interest we’ll facilitate a phone number swap. If not no sweat!";
const expectedSimple = "Hi Anna, your match Grace has confirmed. At 8pm PT Wednesday, you’ll receive a phone call connecting you with your match. If you miss the call, you can call back. Afterwards, we’ll ask if you want to swap phone numbers. In the case of mutual interest we’ll facilitate a phone number swap. If not no sweat!";

it("matchNotification for a single match - ET", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-04:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual(expectedSimpleET);
});

it("matchNotification for a single match - PT", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual(expectedSimple);
});

it("matchNotification for a single match - no fun facts for user", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace", "funFacts");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual(expectedSimple);
});

it("matchNotification for a single match - no fun facts for match", async () => {
    const user1 = user("Anna", "funFacts");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual(expectedSimple);
});

it("matchNotification for a single match - fun facts for both", async () => {
    const user1 = user("Anna", "funFacts");
    const user2 = user("Grace", "funFactsGrace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(2);
    expect(res[0]).toEqual(expectedSimple);
    expect(res[1]).toEqual(`Here are a few fun facts about Grace: "funFactsGrace"

Happy chatting!`)
});

it("matchNotification for two matches", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const user3 = user("Rachael");
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0].startsWith("Hi Anna, we have two Voicebar matches for you! On Wednesday you'll be chatting with Grace and on Thursday you'll be chatting with Rachael. At 8pm PT both nights you’ll receive a phone call connecting you with your match."))
        .toBeTruthy();
});

it("matchNotification for two matches - no fun facts for user", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace", "funFacts");
    const user3 = user("Rachael", "funFacts");
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0].startsWith("Hi Anna, we have two Voicebar matches for you! On Wednesday you'll be chatting with Grace and on Thursday you'll be chatting with Rachael. At 8pm PT both nights you’ll receive a phone call connecting you with your match."))
        .toBeTruthy();
});

it("matchNotification for two matches - fun facts", async () => {
    const user1 = user("Anna", "funFacts");
    const user2 = user("Grace");
    const user3 = user("Rachael", "funFactsRachael");
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(2);
    expect(res[0].startsWith("Hi Anna, we have two Voicebar matches for you! On Wednesday you'll be chatting with Grace and on Thursday you'll be chatting with Rachael. At 8pm PT both nights you’ll receive a phone call connecting you with your match."))
        .toBeTruthy();
    expect(res[1]).toEqual(`Here are a few fun facts about Rachael: "funFactsRachael"`)
});