import firebase from "firebase";

export const NotFound = Symbol("NotFound");

export async function getPreferences(userId?: string): Promise<Record<string, any> | typeof NotFound> {
  try {
    const res = await firebase.functions().httpsCallable("getPreferences")({ userId });
    return res.data;
  } catch (err) {
    if (err.code === "not-found") {
      return NotFound;
    } else {
      throw err;
    }
  }
}

