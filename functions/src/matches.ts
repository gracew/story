import { Firestore, IMatch, IUser } from "./firestore";

const firestore = new Firestore();

function createUpcomingMatchView(match: IMatch, otherUser: IUser) {
  const mode = match.mode || "phone";
  let photo = undefined;
  switch (mode) {
    case "phone":
      photo = undefined;
      break;
    case "video":
      photo = otherUser.photo;
      break;
  }
  return {
    firstName: otherUser.firstName,
    gender: otherUser.gender,
    funFacts: otherUser.funFacts || "",
    mode,
    photo,
    meetingTime: match.created_at.toDate(),
  };
}

export async function listUpcomingMatchViewsForUser(viewingUser: IUser) {
  const matches = await firestore.upcomingMatchesForUser(viewingUser.id);
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
    upcomingMatches.push(createUpcomingMatchView(match, otherUsers[0]));
  }
  return upcomingMatches;
}
