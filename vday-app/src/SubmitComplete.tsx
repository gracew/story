import { Button } from "antd";
import "firebase/analytics";
import "firebase/functions";
import React from "react";
import { useLocation } from "react-router-dom";
import "./SubmitComplete.css";

function SubmitComplete() {
    const query = new URLSearchParams(useLocation().search);
    const firstName = query.get("name");

    return (
        <div className="vday-record">
            <div>
                <h2>Thanks so much, {firstName}!</h2>
                <p>We can't wait to hear about your experience with dating apps. If we love it we'll feature it on our homepage or on our social accounts!</p>
                <p>If the current dating apps aren't doing it for you, give <a href="https://storydating.com">Story Dating</a> a try: it's a voice-first experience that focuses on connection over personality.</p>
                <Button className="back-to-homepage">Back to homepage</Button>
                <p>Questions? Contact <a href="mailto:hello@storydating.com">hello@storydating.com</a></p>
            </div>
        </div>
    );
}

export default SubmitComplete;