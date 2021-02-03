import * as functions from "firebase-functions";
import * as sendgrid from "@sendgrid/mail";

sendgrid.setApiKey(functions.config().sendgrid.key);

export async function sendConfirmationEmail(user: any) {
  const welcomeEmailText = `Hi ${user.firstName},

Thanks for your interest in Story Dating! We are a personalized matchmaking service that helps you meet new people, have interesting conversations, and form genuine connections.

We are currently limiting the number of new users so that we can focus on providing high-quality, curated matches. We'll add you to our waitlist and notify you when a spot opens up. In the meantime, you can get off the waitlist sooner by referring your friends using this personalized link: https://storydating.com/join?r=${user.id}.

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