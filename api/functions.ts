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
}

export namespace Responses {
  export interface GetUpcomingMatches {
    upcomingMatches: Resources.UpcomingMatch[];
  }
  export interface GetCommonAvailability {
    commonAvailability: Types.JSONDateTime;
    tz: string;
  }
}

export namespace Resources {
  export interface CommonAvailability {
    commonAvailability: Types.JSONDateTime[],
    tz: string;
  }
  export interface UpcomingMatch {
    firstName: string;
    // photo is undefined if they haven't been "revealed" yet... i.e., they haven't had their phone meeting yet
    photo?: string;
    funFacts: string;
    meetingTime: Types.JSONDateTime;
    mode: Types.MatchMode;
    gender: string;
  }
}
export interface MatchApi {
  getUpcomingMatches(): Promise<Responses.GetUpcomingMatches>;
  getCommonAvailability(request: Requests.GetCommonAvailability): Promise<Responses.GetCommonAvailability>;
  rescheduleMatch(request: Requests.RescheduleMatch): Promise<void>;
  cancelMatch(request: Requests.CancelMatch): Promise<void>;
}

export namespace Types {
  // via Date.prototype.toJSON
  export type JSONDateTime = string;
  // TODO: make this an enum
  export type MatchMode = "video" | "phone";
}
