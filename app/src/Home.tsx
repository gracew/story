import { Button } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/remote-config";
import React from "react";
import "./Home.css";

function Home() {
  function onCtaClick() {
    firebase.analytics().logEvent("sign_up", {});
    window.location.href = firebase.remoteConfig().getString("typeform_url");
  }

  return (
    <div className="home">
      <h2>Want to skip texting back and forth?</h2>
      <p>Record your own voice bio and get matched for voice dates.</p>
      <Button type="primary" onClick={onCtaClick}>
        Get matched for voice dates
      </Button>
    </div>
  );
}

export default Home;
