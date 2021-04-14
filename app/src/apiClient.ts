import firebase from "firebase";

export class NotFound {}

export async function getPreferences(): Promise<Record<string, any> | NotFound> {
  const res = await firebase.functions().httpsCallable("getPreferences")();
  return res.data || NotFound;
}


