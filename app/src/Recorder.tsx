import { ReactMic, ReactMicStopEvent } from "@cleandersonlobo/react-mic";
import useInterval from "@use-it/interval";
import { Button, Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/functions";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import "./Recorder.css";
const uuid = require("uuid");

function TimedRecordButton({
  stopRecording,
  minLength,
  maxLength,
}: {
  stopRecording: () => void;
  minLength: number;
  maxLength: number;
}) {
  const [recordingTimer, setRecordingTimer] = useState(0);
  useInterval(() => {
    setRecordingTimer((recordingTimer) => recordingTimer + 1);
    if (maxLength <= recordingTimer) {
      stopRecording();
    }
  }, 1000);
  const timeRemaining = minLength - recordingTimer;
  const recordText =
    recordingTimer < minLength
      ? `Stop recording (available in ${timeRemaining}s)`
      : "Stop recording";
  return (
    <Button
      className="record-stop"
      disabled={recordingTimer < minLength}
      onClick={stopRecording}
      type="primary"
    >
      {recordText}
    </Button>
  );
}

// https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
function iOS() {
  return [
    "iPad Simulator",
    "iPhone Simulator",
    "iPod Simulator",
    "iPad",
    "iPhone",
    "iPod",
  ].includes(navigator.platform);
}

function Recorder() {
  const history = useHistory();
  const [phoneRegistered, setPhoneRegistered] = useState();
  const [referrer, setReferrer] = useState<any>();
  const [loadingReferrer, setLoadingReferrer] = useState(false);
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
      .httpsCallable("phoneRegistered")({
        phone: request.phone,
      })
      .then((res) => setPhoneRegistered(res.data));
  }, [request.phone]);

  useEffect(() => {
    if (request.referrerUsername !== "_____") {
      setLoadingReferrer(true);
      firebase
        .functions()
        .httpsCallable("getUserByUsername")({
          username: request.referrerUsername,
        })
        .then((res) => {
          setReferrer(res.data);
          setLoadingReferrer(false);
        });
    }
  }, [request.referrerUsername]);

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
    .logEvent("recorder", { referrer_username: request.referrerUsername });

  if (phoneRegistered === undefined) {
    return <Spin size="large" />;
  }
  if (phoneRegistered) {
    history.push("/register/error");
  }
  if (loadingReferrer) {
    return <Spin size="large" />;
  }

  let text;
  if (referrer) {
    text = `We'll share it with ${referrer.firstName}`;
    if (request.otherPeople === "Yes") {
      text += " and other potential matches";
    }
  } else {
    text = `We'll share it with potential matches`;
  }
  text +=
    ". You’ll also get a personal link to your voice bio that you can share on your dating profiles.";

  return (
    <div>
      <h2>Record your own voice bio</h2>
      <p>{text}</p>
      <div className="record-prompts">
        <div>Your best funny/inspiring/travel story?</div>
        <div>The most spontaneous thing you’ve ever done?</div>
        <div>Something that surprises people about you?</div>
        <div>Or say anything on your mind!</div>
      </div>
      {recording ? (
        <TimedRecordButton
          stopRecording={() => setRecording(false)}
          minLength={20}
          maxLength={120}
        />
      ) : (
        <Button
          className="record-stop"
          onClick={() => setRecording(true)}
          type={bio ? "default" : "primary"}
        >
          {bio ? "Record again" : "Record"}
        </Button>
      )}
      <ReactMic
        className={recording && !iOS() ? "se-react-mic" : "se-react-mic-hide"}
        record={recording}
        // @ts-ignore
        mimeType="audio/mp3"
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
