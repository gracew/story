import myzod, { Infer } from "myzod";

export module Endpoints {
  export const getUpcomingMatchesSchema = myzod.object({
    upcomingMatches: myzod.array(Resources.upcomingMatchSchema),
  });
  export type GetUpcomingMatches = Infer<typeof getUpcomingMatchesSchema>;
}

export module Resources {
  export const upcomingMatchSchema = myzod.object({
    firstName: myzod.string(),
    // photo is undefined if they haven't been "revealed" yet... i.e., they haven't had their phone meeting yet
    photo: myzod.string().optional(),
    funFacts: myzod.string(),
    meetingTime: myzod.date(),
    mode: myzod.enum(Types.MatchMode),
  });
  export type UpcomingMatch = Infer<typeof upcomingMatchSchema>;
}

export module Types {
  export enum MatchMode {
    video = "video",
    phone = "phone",
  }
}
