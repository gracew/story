import * as uuid from "uuid";
import { matchNotification } from "../src/smsCopy";
import { match, user } from "./mock";

const userId1 = uuid.v4();
const userId2 = uuid.v4();
const userId3 = uuid.v4();
const expectedSimpleET = "Hi Anna, on Wednesday you'll be chatting with Grace from the San Francisco Bay Area. At 8:00pm EDT";
const expectedSimple = "Hi Anna, on Wednesday you'll be chatting with Grace from the San Francisco Bay Area. At 8:00pm PDT";
const expectedTwoMatches = "Hi Anna, we have two matches for you! On Wednesday you'll be chatting with Grace and on Thursday you'll be chatting with Rachael. They are both from the San Francisco Bay Area. At 8:00pm PDT both nights";
const expectedTwoMatchesSameLocation = "Hi Anna, we have two matches for you! On Wednesday you'll be chatting with Grace and on Thursday you'll be chatting with Rachael. They are both from New York City. At 8:00pm PDT both nights";
const expectedTwoMatchesDiffLocation = "Hi Anna, we have two matches for you! On Wednesday you'll be chatting with Grace from New York City and on Thursday you'll be chatting with Rachael from the San Francisco Bay Area. At 8:00pm PDT both nights";

it("matchNotification for a single match - ET", async () => {
    const user1 = user("Anna");
    user1.timezone = "ET";
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-04:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedSimpleET)
});

it("matchNotification for a single match - PT", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedSimple)
});

it("matchNotification formats time according to each user's timezone", async () => {
    const user1 = user("Anna");
    user1.timezone = "PT";
    const user2 = user("Grace");
    user2.timezone = "CT";
    const m = match(userId1, userId2, "2020-09-23T19:00:00-07:00");

    const user1Res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(user1Res).toHaveLength(1);
    expect(user1Res[0]).toContain("At 7:00pm PDT")

    const user2Res = matchNotification(userId2, [m], { [userId1]: user1, [userId2]: user2 })
    expect(user2Res).toHaveLength(1);
    expect(user2Res[0]).toContain("At 9:00pm CDT")
});

it("matchNotification correctly formats half past dates", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:30:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain("8:30pm PDT")
});

it("matchNotification for a single match - no fun facts for user", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace", "funFacts");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedSimple)
});

it("matchNotification for a single match - no fun facts for match", async () => {
    const user1 = user("Anna", "funFacts");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedSimple)
});

it("matchNotification for a single match - fun facts for both", async () => {
    const user1 = user("Anna", "funFacts");
    const user2 = user("Grace", "funFactsGrace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(2);
    expect(res[0]).toContain(expectedSimple)
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
    expect(res[0]).toContain(expectedTwoMatches);
});

it("matchNotification for two matches - no fun facts for user", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace", "funFacts");
    const user3 = user("Rachael", "funFacts");
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedTwoMatches);
});

it("matchNotification for two matches - fun facts", async () => {
    const user1 = user("Anna", "funFacts");
    const user2 = user("Grace");
    const user3 = user("Rachael", "funFactsRachael");
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(2);
    expect(res[0]).toContain(expectedTwoMatches);
    expect(res[1]).toEqual(`Here are a few fun facts about Rachael: "funFactsRachael"`)
});

it("matchNotification for two matches - same location", async () => {
    const user1 = user("Anna", undefined, "location", true);
    const user2 = user("Grace", undefined, "New York City", true);
    const user3 = user("Rachael", undefined, "New York City", true);
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedTwoMatchesSameLocation);
});

it("matchNotification for two matches - others not flexible", async () => {
    const user1 = user("Anna", undefined, "New York City", true);
    const user2 = user("Grace", undefined, "New York City", false);
    const user3 = user("Rachael", undefined, "New York City", false);
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedTwoMatchesSameLocation);
});

it("matchNotification for two matches - diff location", async () => {
    const user1 = user("Anna", undefined, "location", true);
    const user2 = user("Grace", undefined, "New York City", true);
    const user3 = user("Rachael", undefined, "San Francisco Bay Area", true);
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedTwoMatchesDiffLocation);
});

it("matchNotification for two matches, different times", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const user3 = user("Rachael");
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:30:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain("At 8:00pm PDT Wednesday you'll be chatting with Grace and at 8:30pm PDT Thursday you'll be chatting with Rachael.")
});