import { Button } from "antd";
import * as firebase from "firebase/app";
import "firebase/storage";
import "firebase/analytics";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// @ts-ignore
import { ReactTypeformEmbed } from "react-typeform-embed";
import "./Listener.css";

function VoiceBio() {
  const [user, setUser] = useState<any>();
  const [bioUrl, setBioUrl] = useState<string>();
  const [specificCta, setSpecificCta] = useState(false);
  const { username } = useParams();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getUserByUsername")({ username })
      .then((res) => {
        setUser(res.data);
        firebase
          .storage()
          .ref(res.data.bio)
          .getDownloadURL()
          .then((url) => setBioUrl(url));
      });
  }, []);

  firebase.analytics().logEvent('voice_bio', { referring_username: username});

  return (
    <div>
      <div>VoiceBio by Speakeasy</div>
      {!user && <p>Loading</p>}
      {user && (
        <div>
          <h1>
            {user.firstName}, {user.age}
          </h1>
          <audio className="se-audio-bio" controls src={bioUrl} />
          <Button type="primary" onClick={() => setSpecificCta(true)}>
            Voice chat with {user.firstName}
          </Button>
          {specificCta && (
            <ReactTypeformEmbed
              url={`https://voicebio.typeform.com/to/BzkJGytE?referralUsername=${username}&referralGender=${user.gender}&referralFirstname=${user.firstName}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default VoiceBio;
