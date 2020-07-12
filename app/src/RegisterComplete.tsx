import React from "react";
import { useLocation } from "react-router-dom";

function RegisterComplete() {
  const query = new URLSearchParams(useLocation().search);
  const username = query.get("username");

  return (
    <div>
      <h2>You're done!</h2>
      <p>
        Thanks for signing up for Speakeasy! You've been added to our waitlist
        and we'll send you a text as soon as we're ready to start matching you.
      </p>
      <p>Share your voice bio with others: voicebio.co/{username}</p>
    </div>
  );
}

export default RegisterComplete;
