const admin = require("firebase-admin");
const util = require("./util");

util.checkRequiredEnvVars(["GOOGLE_APPLICATION_CREDENTIALS"]);

admin.initializeApp();

const median = arr => {
  const mid = Math.floor(arr.length / 2);
  const nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

admin
  .firestore()
  .collection("users")
  .get()
  .then(async (res) => {
    const menMatchMin = [];
    const menMatchMax = [];
    const womenMatchMin = [];
    const womenMatchMax = [];
    res.docs.forEach(doc => {
      const matchMin = doc.get("matchMin") - doc.get("age");
      const matchMax = doc.get("matchMax") - doc.get("age");
      if (doc.get("gender") === "Male") {
        if (matchMin) {
          menMatchMin.push(matchMin);
        }
        if (matchMax) {
          menMatchMax.push(matchMax);
        }
      } else if (doc.get("gender") === "Female") {
        if (matchMin) {
          womenMatchMin.push(matchMin);
        }
        if (matchMax) {
          womenMatchMax.push(matchMax);
        }
      }
    });
    console.log("median menMatchMin: " + median(menMatchMin));
    console.log("median menMatchMax: " + median(menMatchMax));
    console.log("median womenMatchMin: " + median(womenMatchMin));
    console.log("median womenMatchMax: " + median(womenMatchMax));
  });
