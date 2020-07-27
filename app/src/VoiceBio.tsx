import { Button, Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import "./VoiceBio.css";

function VoiceBio() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>();
  const [bioUrl, setBioUrl] = useState<string>();
  const { username } = useParams();
  const history = useHistory();

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

  return (
    <div className="vb-container">
      <h1 className="vb-name">{user.firstName}</h1>
      <h3 className="vb-meta">
        {user.gender}, {user.age}
      </h3>
      <audio className="se-audio-bio" controls src={bioUrl} />
      <p>Want to skip texting back and forth?</p>
      <p className="vb-cta-description">
        Record your own voice bio and set up a voice date with {user.firstName}.
      </p>
      <Button
        className="vb-cta"
        type="primary"
        href={`https://voicebar.typeform.com/to/NUynD2GT?referrerUsername=${username}&referrerFirstname=${user.firstName}`}
      >
        Set up a voice date with {user.firstName}
      </Button>
    </div>
  );
}

export default VoiceBio;
