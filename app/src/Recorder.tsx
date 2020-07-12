import { Button, Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/functions";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { ReactMic, ReactMicStopEvent } from "react-mic";
import { useHistory, useLocation } from "react-router-dom";
import "./Recorder.css";
const uuid = require("uuid");

function Recorder() {
  const history = useHistory();
  const [referrer, setReferrer] = useState<any>();
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bio, setBio] = useState<ReactMicStopEvent>();
  const query = new URLSearchParams(useLocation().search);
  const request: Record<string, string> = {};
  query.forEach((value, key) => {
    request[key] = value;
  });

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getUserByUsername")({
        username: request.referrerUsername,
      })
      .then((res) => {
        setReferrer(res.data);
      });
  }, []);

  async function onSubmit() {
    setSubmitting(true);
    const ref = firebase.storage().ref(`/bios/${uuid.v4()}`);
    await ref.put(bio!.blob);
    try {
      const res = await firebase.functions().httpsCallable("registerUser")({
        ...request,
        bio: ref.fullPath,
      });
      history.push(
        `/register/complete?username=${res.data.username}&referrerUsername=${request.referrerUsername}`
      );
    } catch (err) {
      history.push("/register/error");
    }
  }

  firebase
    .analytics()
    .logEvent("recorder", { referring_username: request.referrerUsername });

  const recordText = recording ? "Stop" : bio ? "Record again" : "Record";
  const buttonType = recording ? "primary" : bio ? "default" : "primary";

  if (!referrer) {
    return <Spin size="large" />;
  }

  let text = `We'll share it with ${referrer.firstName}`;
  if (request.otherMen === "Yes") {
    text += " and other men";
  } else if (request.otherWomen === "Yes") {
    text += " and other women";
  }

  return (
    <div>
      <h2>Record your own voice bio</h2>
      <p>{text}.</p>
      <div className="record-prompts">
        <div>Your best travel story?</div>
        <div>The most spontaneous thing you’ve ever done?</div>
        <div>Something that surprises people about you?</div>
        <div>Or say anything on your mind!</div>
      </div>

      <Button
        className="record-stop"
        onClick={() => setRecording(!recording)}
        type={buttonType}
      >
        {recordText}
      </Button>
      <ReactMic
        className={recording ? "se-react-mic" : "se-react-mic-hide"}
        record={recording}
        onStop={(blob) => setBio(blob)}
      />
      {bio && !recording && (
        <audio
          className="se-recording-playback"
          controls
          src={bio && bio.blobURL}
        />
      )}

      {bio && (
        <Button
          className="se-submit-bio"
          disabled={bio === undefined || recording || submitting}
          onClick={onSubmit}
          type="primary"
        >
          {!submitting && <div>Submit</div>}
          {submitting && (
            <div>
              Submitting... <Spin size="small" />
            </div>
          )}
        </Button>
      )}
    </div>
  );
}

export default Recorder;
