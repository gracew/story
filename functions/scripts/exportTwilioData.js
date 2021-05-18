const admin = require("firebase-admin");
const util = require("./util");
const twilio = require("twilio");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BUCKET = "speakeasy-prod.appspot.com";

// dir is either 'to' or 'from'
async function saveMessages(id, phone, dir, filename) {
  const messages = await client.messages.list({ [dir]: phone });
  messages.forEach(msg => {
    // replace the user phone with the user ID
    msg[dir] = userId;
  });
  const filePath = path.join(os.tmpdir(), filename)
  console.log("writing to temp file " + filePath);
  fs.writeFileSync(filePath, JSON.stringify(messages));
  await admin.storage().bucket(BUCKET).upload(filePath, { destination: `twilio/${id}/${filename}` });
}

async function saveCalls(id, phone, dir, filename) {
  const calls = await client.calls.list({ [dir]: phone });
  calls.forEach(call => {
    call[dir] = userId;
    call[dir + "Formatted"] = userId;
  });
  const filePath = path.join(os.tmpdir(), filename)
  console.log("writing to temp file " + filePath);
  fs.writeFileSync(filePath, JSON.stringify(calls));
  await admin.storage().bucket(BUCKET).upload(filePath, { destination: `twilio/${id}/${filename}` });
}

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS", "TWILIO_AUTH_TOKEN", "USER_ID"]);
const client = twilio("AC07d4a9a61ac7c91f7e5cecf1e27c45a6", process.env.TWILIO_AUTH_TOKEN);

admin.initializeApp();

const userId = process.env.USER_ID;
admin
  .firestore()
  .collection("users")
  .doc(userId)
  .get()
  .then(async (doc) => {
    const phone = doc.get("phone");

    saveMessages(userId, phone, 'to', "messages_to.json")
    saveMessages(userId, phone, 'from', "messages_from.json")

    saveCalls(userId, phone, 'to', "calls_to.json")
    saveCalls(userId, phone, 'from', "calls_from.json")
  });
