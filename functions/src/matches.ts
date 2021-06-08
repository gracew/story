import moment = require("moment");
import { Firestore, IMatch, IUser } from "./firestore";

const firestore = new Firestore();

function createUpcomingMatchView(match: IMatch, viewingUser: IUser, otherUser: IUser) {
  // the users connected successfully via twilio OR both users joined the video call
  const connected = (match.twilioSid !== undefined || (match.mode === "video" && Object.keys((match.joined || {})).length === 2))
  const mode = match.mode || "phone";
  const photo = (connected || mode === "video") ? otherUser.photo : undefined;
  const minutesSinceMatch = moment().diff(match.created_at.toDate(), "minutes");
  const inRevealWindow = 
    // if a phone call, it ended < 1 hour ago
    (mode === "phone" && minutesSinceMatch >= 20 && minutesSinceMatch < 80)
    // if a video call, it ended < 1 hour ago
    || (mode === "video" && minutesSinceMatch >= 60 && minutesSinceMatch < 120);
  const requestReveal = connected && inRevealWindow
    // the user hasn't responded yet to the reveal request
    && match.revealed[viewingUser.id] === undefined;
  return {
    firstName: otherUser.firstName,
    gender: otherUser.gender,
    funFacts: otherUser.funFacts || "",
    mode,
    photo,
    id: match.id,
    meetingTime: match.created_at.toDate(),
    requestReveal,
  };
}

export async function listUpcomingMatchViewsForUser(viewingUser: IUser) {
  const matches = await firestore.thisWeeksMatchesForUser(viewingUser.id);
  const allUserById = await firestore.getUsersForMatches(matches);
  const upcomingMatches = [];
  for (const match of matches) {
    const otherUsers = match.user_ids
      .filter((id) => id !== viewingUser.id)
      .map((userId) => allUserById[userId]);
    if (otherUsers.length !== 1) {
      console.error(
        new Error(
          `match ${match.id} contains ${otherUsers.length} other users, should have just been 1`
        )
      );
      continue;
    }
    upcomingMatches.push(createUpcomingMatchView(match, viewingUser, otherUsers[0]));
  }
  return upcomingMatches;
}
