import * as functions from "firebase-functions";
import * as moment from "moment";

var Airtable = require('airtable');
const baseId = functions.config().airtable.id;
const apiKey = functions.config().airtable.key;

var base = new Airtable({apiKey: apiKey}).base(baseId);

export const addUserToAirtable = (userData : {[key: string]: any}) =>{

    let signUpDate = moment(userData["signUpDate"])

    var newUser: { [key: string]: any}={
            "First": userData["firstName"],
            "Last" : userData["lastName"],
            "Age" : userData["age"],
            "Gender" : userData["gender"],
            "Status" : "Not Contacted",
            "Phone" : userData["phone"],
            "UserID" : userData.id,
            "Fun Facts": userData["funFacts"],
            "Email": userData["email"],
            "Ethnicity": userData["race"] ? [userData["race"]] : ["Prefer not to say"],
            "Flexible on Location": userData["locationFlexibility"] ? "Yes" : "No",
            "Match Age": userData["agePreference"],
            "Social Media": userData["social"],
            "How did you find us?": userData["whereDidYouHearAboutVB"],
            "Sign Up Date": signUpDate.format("YYYY-MM-DD"),
            "Wants": userData["genderPreference"],
            "Interests": userData["interests"] ? userData["interests"].split(",") : ["NO RESPONSE"],
            "Referrer": userData["referrer"]
    }

    if(userData["location"] === "New York City"){
        newUser["Location"] = ["rec0DSKUmtOWSs5if"]
    }
    else if (userData["location"] ==="San Francisco Bay Area"){
        newUser["Location"] = ["recJhdcbeELxPNtgG"]
    }
    else {
        newUser["TF Location"] = userData["location"]
    }
    console.log(newUser)
    base('Users').create(newUser, {typecast: true}, function(err : any, record: any) {
        if (err) {
          console.error(err);
          return;
        }
        console.log("Created record: " + record.getId())
      });
}
