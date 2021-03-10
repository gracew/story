import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as moment from "moment-timezone";
import { IUser } from "./firestore";
import { welcome } from "./smsCopy";
import { client, TWILIO_NUMBER } from "./twilio";

/** Called upon typeform submission to save user data in firebase. */
export const registerUser = functions.https.onRequest(async (req, response) => {
  const answersIdMap: { [key: string]: string } = {
    "bc7dad0e-d1ee-42d5-b9b0-4b15b5d1b102": "firstName",
    "e9ad7465-f6cf-457f-8679-ff188616e43e": "lastName",
    "6fa1f2c6-a197-4509-bd40-561be56369ae": "age",
    "2a7363b5-ef3d-409d-9a4b-7e673ac70cb5": "gender",
    "c0e58906-8dc5-4471-a528-8e2290186ef0": "race",
    "b67c3eee-a90d-4302-a710-6556829b6817": "email",
    "6775fb10-e9a5-4ea6-909a-c939fed72695": "location",
    "ff785a0b-f3a0-4406-aa13-ea266e9bb2d7": "locationFlexibility",
    "3a3112de-77a8-40e8-bce8-3f7fec4bb6dd": "matchMin",
    "f88f7eef-745f-415d-8675-307965e200d6": "matchMax",
    "a5199299-4665-4e9b-87c7-eac644077f28": "phone",
    "1cb2d597-5a52-406b-bc12-45bdea0d877f": "genderPreference",
    "34932f3b-5120-47c2-8053-1c61c3f5ff6f": "funFacts",
    "ead263db-6980-4ebe-9bc4-2956ce894fd3": "interests",
    "4cef01ee-ed52-48b4-8f2b-902d38dafcf0": "social",
    "1b6b3940-ba10-46f3-bd8b-17b7f32e93f8": "whereDidYouHearAboutUs",
  };

  const user: { [key: string]: any } = {
    referrer: req.body.form_response.hidden.r,
    registeredAt: new Date(req.body.form_response.submitted_at),
    eligible: true,
    status: "waitlist",
  };

  const answers = req.body.form_response.answers;

  for (const a of answers) {
    const refff: string = a.field.ref;
    const key = answersIdMap[refff];
    if (!key) {
      continue;
    }
    if (
      a.type === "text" ||
      a.type === "boolean" ||
      a.type === "email" ||
      a.type === "number" ||
      a.type === "phone_number" ||
      a.type === "long_text" ||
      a.type === "short_text"
    ) {
      user[key] = a[a.type];
    } else if (a.type === "choice") {
      user[key] = a.choice.label ? a.choice.label : a.choice.other;
    } else if (a.type === "choices") {
      user[key] = a.choices.labels;
    }
  }

  if (user.phone) {
    user.phone = user.phone.split(" ").join("");
  } else if (req.body.form_response.hidden.phone) {
    const trimmed = req.body.form_response.hidden.phone.trim();
    if (trimmed.startsWith("+")) {
      user.phone = trimmed;
    } else if (trimmed.length === 10) {
      user.phone = "+1" + trimmed;
    } else {
      console.error("unable to handle phone number: " + trimmed);
    }
  }
  if (user.location === "San Francisco Bay Area") {
    user.timezone = "PT";
  } else if (user.location === "New York City") {
    user.timezone = "ET";
  }

  // overwrite genderPreference to match previous multiple selection format
  switch (user.genderPreference) {
    case "Men":
      user.genderPreference = ["Men"];
      break;
    case "Women":
      user.genderPreference = ["Women"];
      break;
    case "Everyone":
      user.genderPreference = ["Men", "Women"];
      break;
    default:
      console.warn("unknown genderPreference: " + user.genderPreference);
  }

  // make sure the phone number hasn't already been registered
  const ue = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", user.phone)
    .get();
  if (!ue.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "phone number has already been registered"
    );
  }

  const reff = admin.firestore().collection("users").doc();
  user.id = reff.id;
  await reff.set(user);
  if (user.phone.length === 12 && user.phone.startsWith("+1")) {
    // US or Canada
    await client.messages.create({
      body: welcome(user as IUser),
      from: TWILIO_NUMBER,
      to: user.phone,
    });
  }

  response.end();
});

export const saveAvailability = functions.https.onRequest(async (req, response) => {
  const week = moment().startOf("week").format("YYYY-MM-DD")
  const userId = req.body.form_response.hidden.u;
  if (!userId) {
    console.error("missing userId");
    response.end();
    return;
  }

  const update = parseAvailability(req.body.form_response.answers, moment);
  await admin.firestore().collection("scheduling").doc(week).collection("users").doc(userId).update(update);
  response.end();
});

export function parseAvailability(answers: any[], getTimestamp: () => moment.Moment) {
  const update: Record<string, any> = { "interactions.responded": true };
  answers.forEach((a: any) => {
    if (a.field.ref === "matches") {
      if (a.choice.label === "Skip this week") {
        update.skip = true;
        update.matches = 0;
        update.available = [];
      } else {
        update.skip = false;
        update.matches = parseInt(a.choice.label);
      }
    } else if (a.field.ref === "timesPT") {
      update.available = a.choices.labels
        .map((c: string) => parseTime(c, "America/Los_Angeles", getTimestamp)?.toDate())
        .filter((d: Date) => d);
    } else if (a.field.ref === "timesCT") {
      update.available = a.choices.labels
        .map((c: string) => parseTime(c, "America/Chicago", getTimestamp)?.toDate())
        .filter((d: Date) => d);
    } else if (a.field.ref === "timesET") {
      update.available = a.choices.labels
        .map((c: string) => parseTime(c, "America/New_York", getTimestamp)?.toDate())
        .filter((d: Date) => d);
    }
  })
  return update;
};

function parseTime(time: string, timezone: string, getTimestamp: () => moment.Moment) {
  const week = getTimestamp().tz(timezone).startOf("week");
  switch (time) {
    case "Tue 6pm":
      return week.add(2, "days").add(18, "hours");
    case "Tue 7pm":
      return week.add(2, "days").add(19, "hours")
    case "Tue 8pm":
      return week.add(2, "days").add(20, "hours")
    case "Tue 9pm":
      return week.add(2, "days").add(21, "hours")
    case "Wed 6pm":
      return week.add(3, "days").add(18, "hours");
    case "Wed 7pm":
      return week.add(3, "days").add(19, "hours");
    case "Wed 8pm":
      return week.add(3, "days").add(20, "hours");
    case "Wed 9pm":
      return week.add(3, "days").add(21, "hours");
    case "Thu 6pm":
      return week.add(4, "days").add(18, "hours");
    case "Thu 7pm":
      return week.add(4, "days").add(19, "hours");
    case "Thu 8pm":
      return week.add(4, "days").add(20, "hours");
    case "Thu 9pm":
      return week.add(4, "days").add(21, "hours");
    default:
      console.error("could not parse time: " + time);
      return undefined;
  }
}