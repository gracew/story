const admin = require("firebase-admin");
const util = require("./util");
const twilio = require("twilio");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);
const client = twilio("AC07d4a9a61ac7c91f7e5cecf1e27c45a6", process.env.TWILIO_AUTH_TOKEN);

admin.initializeApp();

const newUsersThisWeek = [
  "KLgXR9rFVovb3fQQMUFG",
  "kcFpgrsweIDs78zXfM2j",
  "waBNHrquTHIM79OPDy4K",
  "InC2I1HURkPCWDQTDN7e",
  "FCZZf8bp0gdoEDf4LEcW",
  "dUJj8QnkrKR70Hkhk2rV",
  "ZWWMoIzIXx67Cqi0s5uO",
  "jJJPbelebB6XFkEFtFnO",
  "R8kZBzdAvPcsQ8GxJNE5",
  "BkL4aOygYGO21OD52sxZ",
]
admin
  .firestore()
  .collection("users")
  .where("status", "in", ["contacted", "resurrected"])
  .get()
  .then(async (res) => {
    await Promise.all(
      res.docs.map((doc) => {
        const firstName = doc.get("firstName");
        const phone = doc.get("phone");
        let body;
        if (!newUsersThisWeek.includes(doc.id)) {
          body = `Hey ${firstName}, what would you do with an extra $100? Fancy dinner with your next in-person Story date, maybe? Friendly reminder about our referral challenge ending May 15! Help us create even better matches by sharing this link with a friend now: https://storydating.com/r?r=${doc.get("id")}`
        } else {
          body = `Big news, ${firstName}: We're doing a referral challenge and giving away... $100 cash to 1 lucky Story user! 💸 Every referral gets you 1 entry to win (hint: try email lists, FB/IG posts, tweets 😉)

We really appreciate you telling your friends about us, and now we want to reward you!

The challenge ends in just 1 week, so share your link right now and we'll text you when someone joins with it: https://storydating.com/r?r=${doc.get("id")}`
        }
        return client.messages.create({
          body,
          to: phone,
          from: "MG35ade708f17b5ae9c9af44c95128182b",
          statusCallback: "https://us-central1-speakeasy-prod.cloudfunctions.net/smsStatusCallback",
        }).catch(console.error);
      }));

  });
