import * as admin from "firebase-admin";
import * as moment from "moment-timezone";
import { IMatch, IUser } from "./firestore";
import { NextMatchNameDate } from "./twilio";

export function welcome(user: IUser) {
  return `Hi ${user.firstName}, thanks for joining Story Dating! I'm Grace and I founded Story because I believe that magic happens when people ✨ like you ✨ choose talking over swiping. You're currently on the waitlist, but I'll text you as soon as I have some matches for you. In the meantime, text any questions to me here or reply with "stop" if you ever decide to pause using Story Dating.

Every friend that you recruit bumps you higher on the waitlist, so share this link with 1 friend now: https://storydating.com/r?r=${user.id}`;
}

export function referralSignup(user: IUser, referral: IUser) {
  return `Way to go, ${user.firstName}! 🥳 You just recruited ${referral.firstName} to Story Dating. That’s one more entry into our $100 giveaway- increase your odds by referring more friends with your custom link 🍀 https://storydating.com/r?r=${user.id}`;
}

export async function availability(user: IUser) {
  const week = moment().startOf("week").format("YYYY-MM-DD");
  const smsCopy = await admin.firestore().collection("smsCopy").doc(week).get();
  let availabilityTexts;
  if (user.status === "waitlist") {
    availabilityTexts = smsCopy.get("availabilityNewUser");
    await admin
      .firestore()
      .collection("users")
      .doc(user.id)
      .update("status", "contacted");
  } else {
    availabilityTexts = smsCopy.get("availability");
  }
  return `${availabilityTexts
    .map((text: string) =>
      text
        .replace("FIRST_NAME", user.firstName)
        .replace("TIMEZONE", user.timezone)
        .replace("USER_ID", user.id)
    )
    .join("\n\n")}`;
}

export function optInReminder(user: IUser) {
  return `Hey, it's Grace from Story Dating! I'm currently scheduling this week's dates - if you'd like to connect this week, let me know your availability here: https://storydating.com/weekly#u=${user.id}&tz=${user.timezone}`;
}

export function matchNotification(
  userId: string,
  matches: IMatch[],
  usersById: Record<string, IUser>
): string[] {
  const nextStepText = `If you miss the call, you can call us back. Afterwards, we'll ask if you want to connect again over video at another time this week.`;
  const user = usersById[userId];
  if (matches.length === 0) {
    return [];
  }

  matches.sort(
    (a, b) => a.created_at.toDate().getTime() - b.created_at.toDate().getTime()
  );
  const tz = timezone(user);
  const formattedTime = formatTime(matches[0].created_at.toDate(), tz);
  if (matches.length === 1) {
    const match = matches[0];
    const matchUserId =
      match.user_a_id === userId ? match.user_b_id : match.user_a_id;
    const matchUser = usersById[matchUserId];
    return [
      `Hi ${user.firstName}, you've got a match! 💘 At ${formattedTime} ${day(
        match.created_at.toDate(),
        tz
      )} you'll be chatting with ${matchUser.firstName}${location(matchUser)}.

Here's how it works: at the time of your date, you'll receive a phone call connecting the two of you for just 20 minutes. ${nextStepText}

Look at what ${matchUser.firstName
      } wrote about themself for you 💌 https://storydating.com/m`,
    ];
  } else if (matches.length === 2) {
    const match1 = matches[0];
    const matchUser1Id =
      match1.user_a_id === userId ? match1.user_b_id : match1.user_a_id;
    const match1User = usersById[matchUser1Id];
    const match1Location = location(match1User);

    const match2 = matches[1];
    const matchUser2Id =
      match2.user_a_id === userId ? match2.user_b_id : match2.user_a_id;
    const match2User = usersById[matchUser2Id];
    const match2Location = location(match2User);
    const formattedTime2 = formatTime(matches[1].created_at.toDate(), tz);

    const day1 = day(match1.created_at.toDate(), tz);
    const day2 = day(match2.created_at.toDate(), tz);
    if (match1Location !== match2Location) {
      return [
        `Hi ${user.firstName}, we have two matches for you! 💘 At ${formattedTime} ${day1} you'll be chatting with ${match1User.firstName}${match1Location}. At ${formattedTime2} ${day2} you'll be chatting with ${match2User.firstName}${match2Location}.

Here's how it works: you'll receive a phone call connecting you and that night's date for just 20 minutes. ${nextStepText}

Read ${match1User.firstName} and ${match2User.firstName}'s intros now: https://storydating.com/m`,
      ];
    } else {
      return [
        `Hi ${user.firstName}, we have two matches for you! 💘 At ${formattedTime} ${day1} you'll be chatting with ${match1User.firstName}. At ${formattedTime2} ${day2} you'll be chatting with ${match2User.firstName}. They are both${match1Location}.
  
Here's how it works: you'll receive a phone call connecting you and that night's date for just 20 minutes. ${nextStepText}

Read ${match1User.firstName} and ${match2User.firstName}'s intros now: https://storydating.com/m`,
      ];
    }
  } else {
    // 3+ matches
    let s = `Hi ${user.firstName}, we have ${matches.length} matches for you this week! 💘

`;
    matches.forEach((m, i) => {
      const matchUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
      const matchUser = usersById[matchUserId];
      s = s + `${i + 1}. ${shortDay(m.created_at.toDate(), tz)} ${formatTime(m.created_at.toDate(), tz)}: ${matchUser.firstName}${location(matchUser)}\n`
    });
    return [s + `
Here's how it works: you'll receive a phone call connecting you and that night's date for just 20 minutes. ${nextStepText}

Read their intros now: https://storydating.com/m`
    ];
  }
}

export function videoMatchNotification(
  userA: IUser,
  userB: IUser,
  matchTime: string
) {
  const tz = timezone(userA);
  return `Hi ${userA.firstName}, you'll be speaking again with ${userB.firstName
    } over video at ${formatTime(matchTime, tz)} on ${day(
      matchTime,
      tz
    )}. We'll send you a reminder and video link earlier that day!`;
}

export function videoFallbackSwapNumbers(userA: IUser, userB: IUser) {
  return `Hi ${userA.firstName}, we weren't able to schedule a video call for you and ${userB.firstName}, but they also wanted to swap numbers! Text them now at ${userB.phone}`;
}

export function videoFallbackTextChat(userA: IUser, userB: IUser) {
  return `Hi ${userA.firstName}, we weren't able to schedule a video call for you and ${userB.firstName}, so we'll connect you in a text chat in just a minute :)`;
}

function location(match: IUser) {
  const the = match.location === "San Francisco Bay Area" ? "the " : "";
  return ` from ${the}${match.location}`;
}

function timezone(user: IUser) {
  if (user.timezone === "ET") {
    return "America/New_York";
  } else if (user.timezone === "CT") {
    return "America/Chicago";
  } else if (user.timezone === "MT") {
    return "America/Denver";
  }
  // TODO(gracew): should probably not return this by default
  return "America/Los_Angeles";
}

export function videoReminderOneHour(userA: IUser, userB: IUser) {
  return `Hi ${userA.firstName}! Just a reminder that you'll be speaking with ${userB.firstName} in an hour. We'll send you the video link when it's time to start. There's no time limit so you can chat for as short or as long as you like.`;
}

export function videoLink(user: IUser, match: IMatch) {
  const aOrB = user.id === match.user_a_id ? "a" : "b";
  return `It's time for your video date! You can join the call in a few minutes at https://storydating.com/v/${match.videoId}/${aOrB}. In case you need it, the passcode is ${match.videoPasscode}. Have fun! 😄`;
}

export async function phoneReminderOneHour(userA: IUser, userB: IUser) {
  const week = moment().startOf("week").format("YYYY-MM-DD");
  const smsCopy = await admin.firestore().collection("smsCopy").doc(week).get();
  const reminderTexts = userA.photo
    ? smsCopy.get("reminder")
    : smsCopy.get("reminderNoPhoto");
  return `${reminderTexts
    .map((text: string) =>
      text
        .replace("FIRST_NAME", userA.firstName)
        .replace("MATCH_NAME", userB.firstName)
    )
    .join("\n\n")}`;
}

export async function phoneReminderTenMinutes(userA: IUser, userB: IUser) {
  return `10 minutes until your date with ${userB.firstName} ⏱️ Turn on your ringer so you don’t miss the call, and have fun!`;
}

export function flakeWarning(userA: IUser, userB: IUser) {
  return `Hi ${userA.firstName}. It looks like you missed your call with ${userB.firstName} today. Respecting our users' time is important, so next time please let us know in advance if you need to reschedule a call. We know mistakes happen, so we'll let it slide this time. But if it happens again, we may remove you from Story.`;
}

export function flakeApology(userA: IUser, userB: IUser) {
  return `Hi ${userA.firstName}, we're really sorry your match wasn't able to connect tonight. We're reaching out to understand why ${userB.firstName} wasn't able to join the call and are working to ensure this doesn't happen again. In the meantime, feel free to text us if you have any feedback on the experience.`;
}

export function chatIntro(userA: IUser, userB: IUser) {
  return `Hi ${userA.firstName}! Just reply here to text with ${userB.firstName}. This chat will expire in 7 days.`;
}

export const chatExpiration =
  "This chat will expire at midnight! If you would like to keep chatting, we suggest swapping numbers :)";

export const prompts = [
  "What's the most obscure subject that you know a lot about?",
  "What's the longest you've ever gone without using your phone?",
  "What’s your most used emoji? What do you think that says about your personality?",
  "What do you spend more money on than most people?",
  "What’s something you are looking forward to in the next month?",
  "Where do you go when you need some inspiration?",
  "What's your favorite item of clothing? Why?",
];

export function rescheduleNotification(
  userA: IUser,
  userB: IUser,
  getTimestamp: () => moment.Moment,
  newTime: string
) {
  const tz = timezone(userA);
  const newDay = tonightOrDay(newTime, tz, getTimestamp);
  return `Hey ${userA.firstName}, ${userB.firstName
    } had a conflict at the scheduled time. Good news tho, you're both available at ${formatTime(
      newTime,
      tz
    )} ${newDay}, so we've rescheduled your call for then! If that time no longer works for you, go to https://storydating.com/m to modify. Enjoy the call!`;
}

export function cancelNotification(
  cancelee: IUser,
  canceler: IUser,
  match: IMatch,
  getTimestamp: () => moment.Moment,
  canceleeNextMatch?: NextMatchNameDate
) {
  const formattedDay = tonightOrDay(
    match.created_at.toDate(),
    timezone(cancelee),
    getTimestamp
  );
  const nextCopy = canceleeNextMatch
    ? `Don't worry, you're still scheduled to speak with ${canceleeNextMatch.nextMatchName} on ${canceleeNextMatch.nextMatchDate} 😍`
    : "We'll be back in touch next week with another match! 💌";

  return `Hi ${cancelee.firstName}, unfortunately ${canceler.firstName} let us know they can no longer make ${formattedDay}'s date They (and we) are sorry about that 😔 ${nextCopy}`;
}

export function revealNoReply(userA: IUser, userB: IUser, userANextMatch?: NextMatchNameDate) {
  const nextCopy = userANextMatch
  ? `No sweat, you're still scheduled to talk to ${userANextMatch.nextMatchName} on ${userANextMatch.nextMatchDate}!`
  : `No sweat, see ya next week!

As a woman-led startup, word of mouth is what has kept us growing. If you enjoy Story, tell your friends to try us too using this link: https://storydating.com/r?r=${userA.id}. This referral link lets us know not to match you with your friends 😉`;

    return `Hi ${userA.firstName}, since we didn't hear from you we'll assume you're not interested in continuing to chat with ${userB.firstName}. ${nextCopy}`;
}

function formatTime(matchTime: string | Date, tz: string) {
  return moment(matchTime).tz(tz).format("h:mma z");
}

function shortDay(matchTime: string | Date, tz: string) {
  return moment(matchTime).tz(tz).format("ddd");
}

function day(matchTime: string | Date, tz: string) {
  return moment(matchTime).tz(tz).format("dddd");
}

function tonightOrDay(
  matchTime: string | Date,
  tz: string,
  getTimestamp: () => moment.Moment
) {
  const todayDate = getTimestamp().tz(tz).format("YYYY-MM-DD");
  const matchMoment = moment(matchTime).tz(tz);
  const matchDate = matchMoment.format("YYYY-MM-DD");
  return todayDate === matchDate ? "tonight" : matchMoment.format("dddd");
}
