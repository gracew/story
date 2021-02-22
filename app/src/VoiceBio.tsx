import { Button, Spin } from "antd";
import "firebase/analytics";
import firebase from "firebase/app";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./VoiceBio.css";

function VoiceBio() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>();
  const [bioUrl, setBioUrl] = useState<string>();
  const { username } = useParams();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getUserByUsername")({ username })
      .then((res) => setUser(res.data))
      // ignore not-found error
      .catch((err) => {})
      .finally(() => setLoading(false));
  }, [username]);

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

  firebase.analytics().logEvent("voice_bio", { referrer_username: username });

  function onPlay() {
    firebase
      .analytics()
      .logEvent("voice_bio_play", { referrer_username: username });
  }

  function onPause() {
    firebase
      .analytics()
      .logEvent("voice_bio_pause", { referrer_username: username });
  }

  function onEnded() {
    firebase
      .analytics()
      .logEvent("voice_bio_ended", { referrer_username: username });
  }

  function onCtaClick() {
    firebase.analytics().logEvent("sign_up", { referrer_username: username });
    window.location.href =
      firebase.remoteConfig().getString("typeform_url") + `#r=${username}`;
  }

  return (
    <div className="vb-container">
      <h1 className="vb-name">{user.firstName}</h1>
      <h3 className="vb-meta">
        {user.gender}, {user.age}
      </h3>
      <audio
        className="se-audio-bio"
        controls
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        src={bioUrl}
      />
      <p>Want to skip texting back and forth?</p>
      <p className="vb-cta-description">
        Record your own voice bio and set up a voice date with {user.firstName}.
      </p>
      <Button className="vb-cta" type="primary" onClick={onCtaClick}>
        Set up a voice date with {user.firstName}
      </Button>
    </div>
  );
}

export default VoiceBio;
