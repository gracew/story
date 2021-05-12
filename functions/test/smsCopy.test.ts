import * as moment from "moment-timezone";
import * as uuid from "uuid";
import { cancelNotification, matchNotification, rescheduleNotification, videoLink, videoMatchNotification } from "../src/smsCopy";
import { match, user } from "./mock";

const getTimestamp = () => moment("2021-04-22T12:00:00-04:00");
const UPCOMING_MATCHES_LINK = "https://storydating.com/m";

const userId1 = uuid.v4();
const userId2 = uuid.v4();
const userId3 = uuid.v4();
const expectedSimpleET = `Hi Anna, you've got a match! 💘 At 8:00pm EDT Wednesday you'll be chatting with Grace from the San Francisco Bay Area.`;
const expectedSimple = `Hi Anna, you've got a match! 💘 At 8:00pm PDT Wednesday you'll be chatting with Grace from the San Francisco Bay Area.`;
const expectedTwoMatches = `Hi Anna, we have two matches for you! 💘 At 8:00pm PDT Wednesday you'll be chatting with Grace. At 8:00pm PDT Thursday you'll be chatting with Rachael. They are both from the San Francisco Bay Area.`;
const expectedTwoMatchesSameLocation = `Hi Anna, we have two matches for you! 💘 At 8:00pm PDT Wednesday you'll be chatting with Grace. At 8:00pm PDT Thursday you'll be chatting with Rachael. They are both from New York City.`;
const expectedTwoMatchesDiffLocation = `Hi Anna, we have two matches for you! 💘 At 8:00pm PDT Wednesday you'll be chatting with Grace from New York City. At 8:00pm PDT Thursday you'll be chatting with Rachael from the San Francisco Bay Area.`;

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
    expect(user1Res[0]).toContain("7:00pm PDT")

    const user2Res = matchNotification(userId2, [m], { [userId1]: user1, [userId2]: user2 })
    expect(user2Res).toHaveLength(1);
    expect(user2Res[0]).toContain("9:00pm CDT")
});

it("matchNotification correctly formats half past dates", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:30:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain("8:30pm PDT")
});

it("matchNotification for a single match", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const m = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const res = matchNotification(userId1, [m], { [userId1]: user1, [userId2]: user2 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedSimple)
    expect(res[0]).toContain(UPCOMING_MATCHES_LINK);
});

it("matchNotification for two matches - sorts by match time", async () => {
    const user1 = user("Anna");
    const user2 = user("Grace");
    const user3 = user("Rachael");
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser3, matchUser2], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedTwoMatches);
    expect(res[0]).toContain(UPCOMING_MATCHES_LINK);
});

it("matchNotification for two matches - same location", async () => {
    const user1 = user("Anna", { location: "location", locationFlexibility: true });
    const user2 = user("Grace", { location: "New York City", locationFlexibility: true });
    const user3 = user("Rachael", { location: "New York City", locationFlexibility: true });
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedTwoMatchesSameLocation);
});

it("matchNotification for two matches - others not flexible", async () => {
    const user1 = user("Anna", { location: "New York City", locationFlexibility: true });
    const user2 = user("Grace", { location: "New York City", locationFlexibility: false });
    const user3 = user("Rachael", { location: "New York City", locationFlexibility: false });
    const matchUser2 = match(userId1, userId2, "2020-09-23T20:00:00-07:00");
    const matchUser3 = match(userId1, userId3, "2020-09-24T20:00:00-07:00");
    const res = matchNotification(userId1, [matchUser2, matchUser3], { [userId1]: user1, [userId2]: user2, [userId3]: user3 })
    expect(res).toHaveLength(1);
    expect(res[0]).toContain(expectedTwoMatchesSameLocation);
});

it("matchNotification for two matches - diff location", async () => {
    const user1 = user("Anna", { location: "location", locationFlexibility: true });
    const user2 = user("Grace", { location: "New York City", locationFlexibility: true });
    const user3 = user("Rachael", { location: "San Francisco Bay Area", locationFlexibility: true });
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
    expect(res[0]).toContain("At 8:00pm PDT Wednesday you'll be chatting with Grace. At 8:30pm PDT Thursday you'll be chatting with Rachael.")
});

it("videoMatchNotification", async () => {
    const user1 = user("Sandra", { timezone: "MT" });
    const user2 = user("Grace");
    expect(videoMatchNotification(user1, user2, "2021-04-22T20:00:00-07:00")).toContain("Hi Sandra, you'll be speaking again with Grace over video at 9:00pm MDT on Thursday");
});

it("videoLink", async () => {
    const userA = user("userA");
    const userB = user("userB");
    const m = match(userA.id, userB.id, "2020-09-23T20:00:00-07:00", {
        videoId: "videoId",
        videoLink: "videoLink",
        videoPasscode: "videoPasscode",
    });
    expect(videoLink(userA, m)).toContain("https://storydating.com/v/videoId/a. In case you need it, the passcode is videoPasscode.");
    expect(videoLink(userB, m)).toContain("https://storydating.com/v/videoId/b. In case you need it, the passcode is videoPasscode.");
});

it("rescheduleNotification", async () => {
    const userA = user("userA");
    const userB = user("userB");
    const notification = rescheduleNotification(userA, userB, getTimestamp, "2021-04-23T21:00:00-07:00");
    expect(notification).toContain("Hey userA, userB had a conflict at the scheduled time")
    expect(notification).toContain("9:00pm PDT Friday")
});

it("rescheduleNotification - tonight", async () => {
    const userA = user("userA");
    const userB = user("userB");
    const notification = rescheduleNotification(userA, userB, getTimestamp, "2021-04-23T21:00:00-07:00");
    expect(notification).toContain("Hey userA, userB had a conflict at the scheduled time")
    expect(notification).toContain("9:00pm PDT Friday")
});

it("cancelNotification", async () => {
    const userA = user("userA");
    const userB = user("userB");
    const m = match(userA.id, userB.id, "2021-04-23T20:00:00-07:00");
    const notification = cancelNotification(userA, userB, m, getTimestamp);
    expect(notification).toContain("Hi userA, unfortunately userB let us know they can no longer make Friday's")
    expect(notification).toContain("We'll be back in touch next week with another match")
});

it("cancelNotification - tonight", async () => {
    const userA = user("userA");
    const userB = user("userB");
    const m = match(userA.id, userB.id, "2021-04-22T20:00:00-07:00");
    const notification = cancelNotification(userA, userB, m, getTimestamp);
    expect(notification).toContain("Hi userA, unfortunately userB let us know they can no longer make tonight's")
    expect(notification).toContain("We'll be back in touch next week with another match")
});

it("cancelNotification - next match", async () => {
    const userA = user("userA");
    const userB = user("userB");
    const m = match(userA.id, userB.id, "2021-04-23T20:00:00-07:00");
    const notification = cancelNotification(userA, userB, m, getTimestamp, { nextMatchName: "userC", nextMatchDate: "Saturday"});
    expect(notification).toContain("Hi userA, unfortunately userB let us know they can no longer make Friday's")
    expect(notification).toContain("speak with userC on Saturday")
});