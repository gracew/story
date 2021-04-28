export namespace Requests {
  export interface CreateMatch {
    userAId: string;
    userBId: string;
    time: Types.JSONDateTime;
    canceled?: boolean;
    mode?: Types.MatchMode;
  }
}

export namespace Responses {
  export interface GetUpcomingMatches {
    upcomingMatches: Resources.UpcomingMatch[];
  }
}

export namespace Resources {
  export interface UpcomingMatch {
    firstName: string;
    // photo is undefined if they haven't been "revealed" yet... i.e., they haven't had their phone meeting yet
    photo?: string;
    funFacts: string;
    meetingTime: Types.JSONDateTime;
    mode: Types.MatchMode;
  }
}

export namespace Types {
  // via Date.prototype.toJSON
  export type JSONDateTime = string;
  // TODO: make this an enum
  export type MatchMode = "video" | "phone";
}
