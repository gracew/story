import * as functions from "firebase-functions";
import * as sendgrid from "@sendgrid/mail";

sendgrid.setApiKey(functions.config().sendgrid.key);

export async function sendWelcomeEmail(user: any) {
  const welcomeEmailText = `Hi ${user.firstName},

Thanks for your interest in Story Dating! Think of us as a personalized matchmaker that finds great matches for you and handles all of the scheduling. Currently we are focused on growing our user base in the US to ensure high quality matches for our users. If that goes well we would love to expand to more regions.

You're on our waitlist now and we'll be in touch when we're available in your region. In the meantime, you can share your personalized referral link with your friends to help us get there sooner: https://storydating.com/join#r=${user.id}.

- Grace from Story Dating
`

  const msg = {
    to: user.email,
    from: 'hello@storydating.com',
    subject: 'Welcome to Story Dating!',
    text: welcomeEmailText,
    trackingSettings: {
      clickTracking: {
        enable: false,
      }
    }
  }
  await sendgrid.send(msg)
}