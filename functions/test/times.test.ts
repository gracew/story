import * as admin from "firebase-admin";
import { formatTime } from "../src/times";

it("formatTime", () => {
    const t = admin.firestore.Timestamp.fromDate(new Date("2021-04-08T20:00:00-04:00"))
    expect(formatTime(t, "America/Los_Angeles")).toEqual("Thursday 5pm");
    expect(formatTime(t, "America/New_York")).toEqual("Thursday 8pm");
});
