import { Spin, Typography } from "antd";
import "firebase/analytics";
import firebase from "firebase/app";
import "firebase/functions";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const { Text } = Typography;

function RegisterComplete() {
  const query = new URLSearchParams(useLocation().search);
  const username = query.get("username");
  const referrerUsername = query.get("referrerUsername");
  firebase
    .analytics()
    .logEvent("register_complete", { referrer_username: referrerUsername });

  const [referrer, setReferrer] = useState<any>();
  const [loadingReferrer, setLoadingReferrer] = useState(false);

  useEffect(() => {
    if (referrerUsername !== "_____") {
      setLoadingReferrer(true);
      firebase
        .functions()
        .httpsCallable("getUserByUsername")({
          username: referrerUsername,
        })
        .then((res) => {
          setReferrer(res.data);
          setLoadingReferrer(false);
        });
    }
  }, [referrerUsername]);

  if (loadingReferrer) {
    return <Spin size="large" />;
  }

  let text = "We'll send you an SMS as soon as ";
  if (referrer) {
    text += `${referrer.firstName} is available to call.`;
  } else {
    text += " we have a match for you.";
  }

  const personalLink = "storydating.com/" + username;
  return (
    <div>
      <h2>You're in!</h2>
      <p>{text}</p>
      <p>In the meantime, share your voice bio in your dating profiles.</p>
      <Text copyable={{ text: "https://" + personalLink }}>{personalLink}</Text>
    </div>
  );
}

export default RegisterComplete;
