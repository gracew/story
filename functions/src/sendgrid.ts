import * as functions from "firebase-functions";

const client = require('@sendgrid/client');
client.setApiKey(functions.config().sendgrid.key);


//Adds user to Sendgrid marketing email list
export const addUsersToSendgrid = (userData : {age: string, email: string, first_name: string, last_name: string}[]) =>{
    let request = {
        body: userData,
        method: 'POST',
        url: '/v3/contactdb/recipients'
    }
    client.request(request)
    .then(([response, body] : [any, any]) => {
      console.log(response.statusCode);
      console.log(response.body);
    })
}