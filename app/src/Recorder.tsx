import * as firebase from "firebase/app";
import "firebase/functions";
import "firebase/storage";
import React, { useState } from "react";
import { ReactMic, ReactMicStopEvent } from "react-mic";
import { useLocation, useHistory } from "react-router-dom";
import "./Recorder.css";
const uuid = require("uuid");

function Recorder() {
  const history = useHistory();
  const [record, setRecord] = useState(false);
  const [bio, setBio] = useState<ReactMicStopEvent>();
  const query = new URLSearchParams(useLocation().search);
  const request = {
    firstName: query.get("name"),
    gender: "female",
    phone: query.get("phone"),
  };

  async function onSubmit() {
    const ref = firebase.storage().ref(`/bios/${uuid.v4()}`);
    await ref.put(bio!.blob);
    await firebase.functions().httpsCallable("registerUser")({
      ...request,
      bio: ref.fullPath,
    });
    history.push("/register/complete");
  }

  return (
    <div>
      <h2>Tell us about yourself!</h2>
      <p>
        No picture, no text, just you and what you want to say. Your matches
        want to hear from you.
      </p>
      <p>
        How would your friends describe you? What are your aspirations? What
        can't you live without? Or tell us anything on your mind!
      </p>
      <ReactMic
        className="se-react-mic"
        record={record}
        onStop={(blob) => setBio(blob)}
      />
      <div className="se-button-group">
        <button disabled={record} onClick={() => setRecord(true)} type="button">
          Record
        </button>
        <button
          disabled={!record}
          onClick={() => setRecord(false)}
          type="button"
        >
          Stop
        </button>
      </div>
      <audio
        className="se-recording-playback"
        controls
        src={bio && bio.blobURL}
      />

      <div className="se-button-group">
        <button
          className="se-submit-bio"
          disabled={bio === undefined}
          onClick={onSubmit}
          type="button"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export default Recorder;
