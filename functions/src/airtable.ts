import * as moment from "moment";
const Airtable = require('airtable');

const baseId = "baseId";
const apiKey = "apiKey";

const base = new Airtable({apiKey: apiKey}).base(baseId);

export const addUserToAirtable = (userData : {[key: string]: any}) =>{

    const signUpDate = moment(userData["signUpDate"])

    const newUser: { [key: string]: any}={
            "First": userData["firstName"],
            "Last" : userData["lastName"],
            "Age" : userData["age"],
            "Gender" : userData["gender"],
            "Status" : "Not Contacted",
            "Phone" : userData["phone"],
            "UserID" : userData.id,
            "Fun Facts": userData["funFacts"],
            "Email": userData["email"],
            "Ethnicity": userData["race"] ? userData["race"] : ["Prefer not to say"],
            "Flexible on Location": userData["locationFlexibility"] ? "Yes" : "No",
            "Match Age": userData["agePreference"],
            "Social Media": userData["social"],
            "How did you find us?": userData["whereDidYouHearAboutVB"],
            "Sign Up Date": signUpDate.format("YYYY-MM-DD"),
            "Wants": userData["genderPreference"],
            "Interests": userData["interests"] ? userData["interests"].split(",") : ["NO RESPONSE"],
            "Referrer": userData["referrer"] ? userData["referrer"] : userData["r"]
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

export const addMatchToAirtable = (matchData : {[key: string]: any}) =>{
    // const {user_a_id, user_b_id} = matchData

    // let userA_recordID: string
    // let userB_recordID: string
    
    // base('Users').select({
    //     maxRecords: 2,
    //     filterByFormula: `OR(UserID = "${user_a_id}", UserID="${user_b_id}")` 
    // }).eachPage(function page(records: any, fetchNextPage: any) {
    //     // This function (`page`) will get called for each page of records.
    
    //     records.forEach(function(record: any) {
    //         console.log("Retrieved: " + record.id)
    //         if (record.get("UserID") === user_a_id) {userA_recordID = record.id}
    //         else {userB_recordID = record.id}
    //     });
    
    //     // To fetch the next page of records, call `fetchNextPage`.
    //     // If there are more records, `page` will get called again.
    //     // If there are no more records, `done` will get called.
    //     fetchNextPage();
    
    // }, function done(err: any) {
    //     if (err) { console.error(err); return; }
    // });

    // const newMatch: { [key: string]: any} = {
    //     "User A": userA_recordID,
    //     "User B": userB_recordID,
    // }


}
