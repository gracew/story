const admin = require("firebase-admin");
const util = require("./util");
const twilio = require("twilio");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);
const client = twilio("AC07d4a9a61ac7c91f7e5cecf1e27c45a6", process.env.TWILIO_AUTH_TOKEN);

admin.initializeApp();

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
        const body = `Big news, ${firstName}: We're doing a referral challenge and giving away... $100 cash to 1 lucky Story user! 💸 Every referral gets you 1 entry to win (hint: try email lists, FB/IG posts, tweets 😉)

We really appreciate you telling your friends about us, and now we want to reward you!

The challenge ends in just 2 weeks, so share your link right now and we'll text you when someone joins with it: https://storydating.com/r?r=${doc.get("id")}`
        return client.messages.create({
          body,
          to: phone,
          from: "MG35ade708f17b5ae9c9af44c95128182b",
          statusCallback: "https://us-central1-speakeasy-prod.cloudfunctions.net/smsStatusCallback",
        }).catch(console.error);
      }));

  });
