import "firebase/analytics";
import "firebase/functions";
import React from "react";
import { useLocation } from "react-router-dom";

function SubmitComplete() {
    const query = new URLSearchParams(useLocation().search);
    const firstName = query.get("name");

    return (
        <div>
            <h2>Thanks so much, {firstName}!</h2>
            <p>We can't wait to hear about your experience with dating apps. If we love it we'll feature it on our homepage or on our social accounts!</p>
            <p>If the current dating apps aren't doing it for you, give <a href="https://storydating.com">Story Dating</a> a try: it's a voice-first experience that focuses on connection over personality.</p>
        </div>
    );
}

export default SubmitComplete;