import { Button } from "antd";
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
  const [record, setRecord] = useState(false);
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
  let text = referrer ? `We'll share it with ${referrer.firstName}` : "";
  if (request.otherMen) {
    text += " and other men";
  } else if (request.otherWomen) {
    text += " and other women";
  }

  const recordText = record ? "Stop" : bio ? "Record again" : "Record";
  const buttonType = record ? "primary" : bio ? "default" : "primary";

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
        onClick={() => setRecord(!record)}
        type={buttonType}
      >
        {recordText}
      </Button>
      <ReactMic
        className={record ? "se-react-mic" : "se-react-mic-hide"}
        record={record}
        onStop={(blob) => setBio(blob)}
      />
      {bio && !record && (
        <audio
          className="se-recording-playback"
          controls
          src={bio && bio.blobURL}
        />
      )}

      {bio && (
        <Button
          className="se-submit-bio"
          disabled={bio === undefined || record}
          onClick={onSubmit}
          type="primary"
        >
          Submit
        </Button>
      )}
    </div>
  );
}

export default Recorder;
