const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

admin
  .firestore()
  .collection("users")
  .where("eligible", "==", true)
  .get()
  .then(async (res) => {
    res.docs.forEach((doc) => {
      const arr = [
        doc.id,
        doc.get("age"),
        doc.get("gender"),
        `"${doc.get("location")}"`,
        doc.get("timezone"),
        doc.get("locationFlexibility"),
        `"${doc.get("genderPreference")}"`,
        doc.get("matchMin"),
        doc.get("matchMax"),
      ];
      console.log(arr.join(","))
    });
  });
