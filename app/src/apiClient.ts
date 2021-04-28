import firebase from "firebase";
import { Requests, Resources, Responses } from "../../api/functions";

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

export async function getUpcomingMatches(): Promise<Resources.UpcomingMatch[]> {
  const res = await firebase.functions().httpsCallable("getUpcomingMatches")();
  const resp = res.data as Responses.GetUpcomingMatches;
  return resp.upcomingMatches;
}

export async function getCommonAvailability(req: Requests.GetCommonAvailability): Promise<Responses.GetCommonAvailability> {
  const res = await firebase.functions().httpsCallable("getCommonAvailability")();
  return res.data as Responses.GetCommonAvailability;
}