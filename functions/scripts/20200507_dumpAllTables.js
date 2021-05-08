const admin = require("firebase-admin");
const serviceAccount = require("/home/sumeet/Downloads/speakeasy-prod-firebase-adminsdk-urdc2-1211d58713.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://speakeasy-prod.firebaseio.com"
});

const { backups } = require('firestore-export-import');

(async () => {
    const exported = await backups();
    console.log(JSON.stringify(exported));
})();
