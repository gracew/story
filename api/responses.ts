// via Date.prototype.toJSON
type JSONDateTime = string;

// corresponds to the `getUpcomingMatches` function
export interface GetUpcomingMatches {
  upcomingMatches: UpcomingMatch[],
}

export interface UpcomingMatch {
  firstName: string,
  // photo is undefined if they haven't been "revealed" yet... i.e., they haven't had their phone meeting yet
  photo?: string,
  funFacts: string,
  meetingTime: JSONDateTime,
  mode: MatchMode,
}

export type MatchMode = "video" | "phone";

