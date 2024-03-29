export namespace Requests {
  export interface GetCommonAvailability {
    matchId: string;
  }

  export interface RescheduleMatch {
    matchId: string;
    newTime: string;
  }

  export interface CancelMatch {
    matchId: string;
  }

  export interface CreateMatch {
    userAId: string;
    userBId: string;
    time: Types.JSONDateTime;
    canceled?: boolean;
    mode?: Types.MatchMode;
  }

  export interface SaveReveal {
    matchId: string;
    reveal: boolean;
  }

  export interface SaveRating {
    matchId: string;
    /* An integer 1-5, inclusive */
    rating: number;
  }
}

export namespace Responses {
  export interface GetUpcomingMatches {
    upcomingMatches: Resources.UpcomingMatch[];
  }
  export interface GetCommonAvailability {
    commonAvailability: Types.JSONDateTime[];
  }
}

export namespace Resources {
  export interface UpcomingMatch {
    id: string;
    firstName: string;
    // photo is undefined if they haven't been "revealed" yet... i.e., they haven't had their phone meeting yet
    photo?: string;
    funFacts: string;
    meetingTime: Types.JSONDateTime;
    mode: Types.MatchMode;
    gender: string;
    requestReveal: boolean;
  }
}

export namespace Types {
  // via Date.prototype.toJSON
  export type JSONDateTime = string;
  // TODO: make this an enum
  export type MatchMode = "video" | "phone";
}
