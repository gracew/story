import { Firestore, IMatch, IUser } from "./firestore";

const firestore = new Firestore();

class UpcomingMatchView {
  constructor(match: IMatch, otherUser: IUser) {
    this.match = match;
    this.otherUser = otherUser;
  }

  get firstName(): string {
    return this.otherUser.firstName;
  }

  get funFacts(): string {
    return this.otherUser.funFacts || "";
  }

  get photo(): string | undefined {
    switch (this.mode) {
      case "phone":
        return undefined;
      case "video":
        return this.otherUser.photo;
    }
  }

  get mode(): "video" | "phone" {
    return this.match.mode || "phone";
  }

  get meetingTime(): Date {
    return this.match.created_at.toDate();
  }

  private match: IMatch;
  private otherUser: IUser;
}

export async function listUpcomingMatchViewsForUser(
  viewingUser: IUser
): Promise<UpcomingMatchView[]> {
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
    upcomingMatches.push(new UpcomingMatchView(match, otherUsers[0]));
  }
  return upcomingMatches;
}
