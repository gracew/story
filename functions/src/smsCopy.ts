import * as moment from "moment-timezone";
import * as admin from "firebase-admin";
import { IMatch, IUser } from "./firestore";

export async function availability(user: IUser, tz: string) {
    const week = moment().startOf("week").format("YYYY-MM-DD");
    const smsCopy = await admin.firestore().collection("smsCopy").doc(week).get();
    const availabilityText = smsCopy.get("availability");
    const referralText = smsCopy.get("referral");
    return `Hi ${user.firstName}. ${availabilityText.replace("TIMEZONE", tz)}

${referralText.replace("USER_ID", user.id)}`;
}

export function matchNotification(userId: string, matches: IMatch[], usersById: Record<string, IUser>): string[] {
    const phoneSwapText = `If you miss the call, you can call back. Afterwards, we'll ask if you want to connect again over video. In the case of mutual interest we'll help schedule a second call. If not no sweat!`;
    const user = usersById[userId];
    if (matches.length === 0) {
        return [];
    }

    const tz = timezone(matches[0]);
    const formattedTime = moment(matches[0].created_at.toDate()).tz(tz).format("h:mma z");
    if (matches.length === 1) {
        const match = matches[0];
        const matchUserId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
        const matchUser = usersById[matchUserId];
        const texts = [
            `Hi ${user.firstName}, on ${day(match)} you'll be chatting with ${matchUser.firstName}${location(user, matchUser)}. At ${formattedTime}, you'll receive a phone call connecting you with your match. ${phoneSwapText}`
        ];
        if (user.funFacts && matchUser.funFacts) {
            texts.push(
                `Here are a few fun facts about ${matchUser.firstName}: "${matchUser.funFacts}"

Happy chatting!`
            );
        }
        return texts;
    } else {
        const match1 = matches[0];
        const matchUser1Id = match1.user_a_id === userId ? match1.user_b_id : match1.user_a_id;
        const match1User = usersById[matchUser1Id];
        const match1Location = location(user, match1User);

        const match2 = matches[1];
        const matchUser2Id = match2.user_a_id === userId ? match2.user_b_id : match2.user_a_id;
        const match2User = usersById[matchUser2Id];
        const match2Location = location(user, match2User);
        const formattedTime2 = moment(matches[1].created_at.toDate()).tz(tz).format("h:mma z");

        const texts = [];
        if (formattedTime === formattedTime2) {
            if (user.locationFlexibility) {
                if (match1Location !== match2Location) {
                    texts.push(
                        `Hi ${user.firstName}, we have two matches for you! On ${day(match1)} you'll be chatting with ${match1User.firstName}${match1Location} and on ${day(match2)} you'll be chatting with ${match2User.firstName}${match2Location}. At ${formattedTime} both nights you'll receive a phone call connecting you with your match. ${phoneSwapText}`
                    );
                } else {
                    texts.push(
                        `Hi ${user.firstName}, we have two matches for you! On ${day(match1)} you'll be chatting with ${match1User.firstName} and on ${day(match2)} you'll be chatting with ${match2User.firstName}. They are both${match1Location}. At ${formattedTime} both nights you'll receive a phone call connecting you with your match. ${phoneSwapText}`
                    );
                }
            } else {
                texts.push(
                    `Hi ${user.firstName}, we have two matches for you! On ${day(match1)} you'll be chatting with ${match1User.firstName} and on ${day(match2)} you'll be chatting with ${match2User.firstName}. At ${formattedTime} both nights you'll receive a phone call connecting you with your match. ${phoneSwapText}`
                );
            }
        } else {
            if (user.locationFlexibility) {
                if (match1Location !== match2Location) {
                    texts.push(
                        `Hi ${user.firstName}, we have two matches for you! At ${formattedTime} ${day(match1)} you'll be chatting with ${match1User.firstName}${match1Location} and at ${formattedTime2} ${day(match2)} you'll be chatting with ${match2User.firstName}${match2Location}. Both nights you'll receive a phone call connecting you with your match. ${phoneSwapText}`
                    );
                } else {
                    texts.push(
                        `Hi ${user.firstName}, we have two matches for you! At ${formattedTime} ${day(match1)} you'll be chatting with ${match1User.firstName} and at ${formattedTime2} ${day(match2)} you'll be chatting with ${match2User.firstName}. They are both${match1Location}. Both nights you'll receive a phone call connecting you with your match. ${phoneSwapText}`
                    );
                }
            } else {
                texts.push(
                    `Hi ${user.firstName}, we have two matches for you! At ${formattedTime} ${day(match1)} you'll be chatting with ${match1User.firstName} and at ${formattedTime2} ${day(match2)} you'll be chatting with ${match2User.firstName}. Both nights you'll receive a phone call connecting you with your match. ${phoneSwapText}`
                );
            }
        }
        if (user.funFacts && match1User.funFacts) {
            texts.push(
                `Here are a few fun facts about ${match1User.firstName}: "${match1User.funFacts}"`
            );
        }
        if (user.funFacts && match2User.funFacts) {
            texts.push(
                `Here are a few fun facts about ${match2User.firstName}: "${match2User.funFacts}"`
            );
        }
        return texts;
    }
}

function location(user: IUser, match: IUser) {
    if (!user.locationFlexibility) {
        return "";
    }
    const the = match.location === "San Francisco Bay Area" ? "the " : "";
    return ` from ${the}${match.location}`
}

function timezone(match: IMatch) {
    const matchTime = moment(match.created_at.toDate()).tz("America/Los_Angeles")
    if (matchTime.hour() === 17) {
        return "America/New_York";
    } else if (matchTime.hour() === 18) {
        return "America/Chicago";
    } else if (matchTime.hour() === 19) {
        return "America/Denver";
    }
    // TODO(gracew): should probably not return this by default
    return "America/Los_Angeles";
}

function day(match: IMatch) {
    const matchTime = moment(match.created_at.toDate()).tz("America/Los_Angeles")
    return matchTime.format("dddd");
}

export function videoReminder(userA: IUser, userB: IUser) {
    return `Hi ${userA.firstName}! Just a reminder that you'll be speaking with ${userB.firstName} in an hour. We'll send you the video link then! There's no time limit so you can chat for as short or as long as you like.`
}

export async function reminder(userA: IUser, userB: IUser) {
    const week = moment().startOf("week").format("YYYY-MM-DD");
    const smsCopy = await admin.firestore().collection("smsCopy").doc(week).get();
    const prompt = smsCopy.get("prompt") || "What's the longest you've ever gone without using your phone?";
    return `Hi ${userA.firstName}! Just a reminder that you'll be speaking with ${userB.firstName} in an hour. Here's one idea to get the conversation started: "${prompt}" Hope you two have a good date!`;
}

export function flakeWarning(userA: IUser, userB: IUser) {
    return `Hi ${userA.firstName}. It looks like you missed your call with ${userB.firstName} today. Respecting our users' time is important, so next time please let us know in advance if you need to reschedule a call. We know mistakes happen, so we'll let it slide this time. But if it happens again, we may remove you from Story.`;
}

export function flakeApology(userA: IUser, userB: IUser) {
    return `Hi ${userA.firstName}, we're really sorry your match wasn't able to connect tonight. We're reaching out to understand why ${userB.firstName} wasn't able to join the call and are working to ensure this doesn't happen again. In the meantime, feel free to text us if you have any feedback on the experience.`;
}

