import { Button } from "antd";
import * as firebase from "firebase/app";
import "firebase/storage";
import "firebase/analytics";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// @ts-ignore
import { ReactTypeformEmbed } from "react-typeform-embed";
import "./VoiceBio.css";

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

  function formatGender(g: string) {
    return g === "m" ? "Male" : "Female";
  }
  return (
    <div className="vb-container">
      {!user && <p>Loading</p>}
      {user && (
        <div>
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
          <p className="vb-questions">Questions? Email hello@voicebar.co</p>
        </div>
      )}
    </div>
  );
}

export default VoiceBio;
