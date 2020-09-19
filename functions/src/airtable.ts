import * as functions from "firebase-functions";
import * as moment from "moment";

var Airtable = require('airtable');
const baseId = functions.config().airtable.id;
const apiKey = functions.config().airtable.key;

var base = new Airtable({apiKey: apiKey}).base(baseId);

export const addUserToAirtable = (userData) =>{

    let signUpDate = moment(userData["signUpDate"])

    var newUser: { [key: string]: any}={
        "fields":{
            "First": userData["firstName"],
            "Last" : userData["lastName"],
            "Age" : userData["age"],
            "Gender" : userData["gender"],
            "Status" : "Not Contacted",
            "Phone" : userData["phone"],
            "UserID" : userData.id,
            "Email": userData["email"],
            "Ethnicity": [userData["race"]],
            "Flexible on Location": userData["locationFlexibility"] ? "Yes" : "No",
            "Match Age": userData["agePreference"],
            "Social Media": userData["social"],
            "How did you find us?": userData["whereDidYouHearAboutVB"],
            "Sign Up Date": signUpDate.format("YYYY-MM-DD"),
            "Wants": userData["genderPreference"],
            "Interests": userData["interests"].split(","),
        }
    }

    if(userData["location"] === "New York City"){
        newUser.fields["Location"] = "rec0DSKUmtOWSs5if"
    }
    else if (userData["location"] ==="San Francisco Bay Area"){
        newUser.fields["Location"] = 'recJhdcbeELxPNtgG'
    }
    else {
        newUser.fields["TF Location"] = userData["location"]
    }

    base('Users').create(newUser, function(err, record) {
        if (err) {
          console.error(err);
          return;
        }
        console.log("Created record: " + record.getId())
      });
}