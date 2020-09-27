import * as moment from "moment-timezone";
import { IMatch, IUser } from "./firestore";

export function availability(user: IUser, timezone: string) {
    return `Hi ${user.firstName}. It's Voicebar. We've got a potential match for you! Are you available for a 30 minute phone call with your match at 8pm ${timezone} any day this week? Please respond with all the days you're free. You can also reply SKIP to skip this week. Respond in the next 3 hours to confirm your date.`;
}

export function matchNotification(userId: string, matches: IMatch[], usersById: Record<string, IUser>): string[] {
    const phoneSwapText = `If you miss the call, you can call back. Afterwards, we’ll ask if you want to swap phone numbers. In the case of mutual interest we’ll facilitate a phone number swap. If not no sweat!`;
    const user = usersById[userId];
    if (matches.length === 0) {
        return [];
    }

    const tz = timezone(matches[0]);
    if (matches.length === 1) {
        const match = matches[0];
        const matchUserId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
        const matchUser = usersById[matchUserId];
        const texts = [
            `Hi ${user.firstName}, your match ${matchUser.firstName} has confirmed. At 8pm ${tz} ${day(match)}, you’ll receive a phone call connecting you with your match. ${phoneSwapText}`
        ];
        if (user.funFacts && matchUser.funFacts) {
            texts.push(
                `Here are a few fun facts about ${matchUser.firstName}: "${matchUser.funFacts}"

Happy chatting!`
            );
        }
        return texts;
    }
    // TODO(gracew): handle multiple match case
    const match1 = matches[0];
    const matchUser1Id = match1.user_a_id === userId ? match1.user_b_id : match1.user_a_id;
    const match1User = usersById[matchUser1Id];
    const match2 = matches[1];
    const matchUser2Id = match2.user_a_id === userId ? match2.user_b_id : match2.user_a_id;
    const match2User = usersById[matchUser2Id];
    const texts = [
        `Hi ${user.firstName}, we have two Voicebar matches for you! On ${day(match1)} you'll be chatting with ${match1User.firstName} and on ${day(match2)} you'll be chatting with ${match2User.firstName}. At 8pm ${tz} both nights you’ll receive a phone call connecting you with your match. ${phoneSwapText}`
    ];
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

function timezone(match: IMatch) {
    const matchTime = moment(match.created_at).tz("America/Los_Angeles")
    if (matchTime.hour() === 17) {
        return "ET";
    } else if (matchTime.hour() === 18) {
        return "CT";
    } else if (matchTime.hour() === 19) {
        return "MT";
    }
    // TODO(gracew): should probably not return this by default
    return "PT";
}

function day(match: IMatch) {
    const matchTime = moment(match.created_at).tz("America/Los_Angeles")
    return matchTime.format("dddd");
}

export function reminder(userA: IUser, userB: IUser) {
    return `Hin ${userA.firstName}! This is Voicebar. Just a reminder that you’ll be speaking with ${userB.firstName} in an hour. Hope you two have a good conversation!`;

}