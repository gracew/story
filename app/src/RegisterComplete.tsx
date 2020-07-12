import * as firebase from "firebase/app";
import "firebase/analytics";
import "firebase/functions";
import { Typography } from "antd";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const { Text } = Typography;

function RegisterComplete() {
  const query = new URLSearchParams(useLocation().search);
  const username = query.get("username");
  const referrerUsername = query.get("referrerUsername");
  firebase.analytics().logEvent('register_complete', { referring_username: referrerUsername});

  const [referrer, setReferrer] = useState<any>();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getUserByUsername")({
        username: referrerUsername,
      })
      .then((res) => {
        setReferrer(res.data);
      });
  }, []);

  if (!referrer) {
    return <p>Loading</p>
  }

  return (
    <div>
      <h2>You're in!</h2>
      <p>We'll send you an SMS as soon {referrer.firstName} is available to call.</p>
      <p>In the meantime, share your voice bio in your dating profiles.</p>
      <Text copyable>voicebar.co/{username}</Text>
    </div>
  );
}

export default RegisterComplete;
