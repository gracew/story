const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

const { backups } = require('firestore-export-import');

(async () => {
    const exported = await backups();
    console.log(JSON.stringify(exported));
})();
