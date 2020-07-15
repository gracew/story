import { Button, Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// @ts-ignore
import { ReactTypeformEmbed } from "react-typeform-embed";
import "./VoiceBio.css";

function VoiceBio() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>();
  const [bioUrl, setBioUrl] = useState<string>();
  const [specificCta, setSpecificCta] = useState(false);
  const { username } = useParams();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getUserByUsername")({ username })
      .then((res) => setUser(res.data))
      // ignore not-found error
      .catch((err) => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      firebase
        .storage()
        .ref(user.bio)
        .getDownloadURL()
        .then((url) => setBioUrl(url));
    }
  }, [user]);

  if (loading) {
    return <Spin size="large" />;
  }
  if (!user) {
    return (
      <div>
        <h2>User not found</h2>
        <p>Oh no! If you typed or pasted this URL, double check it.</p>
      </div>
    );
  }

  firebase.analytics().logEvent("voice_bio", { referring_username: username });

  function formatGender(g: string) {
    return g === "m" ? "Male" : "Female";
  }

  return (
    <div className="vb-container">
      <h1 className="vb-name">{user.firstName}</h1>
      <h3 className="vb-meta">
        {formatGender(user.gender)}, {user.age}
      </h3>
      <audio className="se-audio-bio" controls src={bioUrl} />
      <Button
        className="vb-cta"
        type="primary"
        onClick={() => setSpecificCta(true)}
      >
        Set up voice call with {user.firstName}
      </Button>
      {specificCta && (
        <ReactTypeformEmbed
          url={`https://voicebio.typeform.com/to/BzkJGytE?referrerUsername=${username}&referrerGender=${user.gender}&referrerFirstname=${user.firstName}`}
        />
      )}
    </div>
  );
}

export default VoiceBio;
