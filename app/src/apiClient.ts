import firebase from "firebase";
import { Moment } from "moment";
import moment from "moment/moment";

export const NotFound = Symbol("NotFound");

export async function getPreferences(
  userId?: string
): Promise<Record<string, any> | typeof NotFound> {
  try {
    const res = await firebase.functions().httpsCallable("getPreferences")({
      userId,
    });
    return res.data;
  } catch (err) {
    if (err.code === "not-found") {
      return NotFound;
    } else {
      throw err;
    }
  }
}

export class UpcomingMatch {
  constructor(upcomingMatchResponse: UpcomingMatchResponse) {
    this.upcomingMatchResponse = upcomingMatchResponse;
  }

  get firstName(): string {
    return this.upcomingMatchResponse.firstName;
  }
  get photo(): string | undefined {
    return this.upcomingMatchResponse.photo;
  }
  get funFacts(): string {
    return this.upcomingMatchResponse.funFacts;
  }
  get mode(): MatchMode {
    return this.upcomingMatchResponse.mode;
  }
  get meetingTime(): Moment {
    return moment(this.upcomingMatchResponse.meetingTime);
  }

  private upcomingMatchResponse: UpcomingMatchResponse;
}

export async function getUpcomingMatches(): Promise<UpcomingMatch[]> {
  const res = await firebase.functions().httpsCallable("getUpcomingMatches")();
  const resp = res.data as GetUpcomingMatches;
  return resp.upcomingMatches.map((matchResp) => new UpcomingMatch(matchResp));
}
