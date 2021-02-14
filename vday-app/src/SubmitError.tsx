import { Button } from "antd";
import React from "react";
import { useHistory } from "react-router-dom";
import "./SubmitError.css";

function SubmitError() {
    const history = useHistory();
    return (
        <div className="submit-error">
            <div>
                <h2>Oh no, something went wrong</h2>
                <p>We're looking into it! Feel free to try again or head back to the homepage to listen to others' responses.</p>
                <Button className="submit-error-button" type="primary" onClick={() => history.push("/record")}>Try again</Button>
                <Button className="submit-error-button" onClick={() => history.push("/")}>Back to homepage</Button>
            </div>
        </div>
    );
}

export default SubmitError;