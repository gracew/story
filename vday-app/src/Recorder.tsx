import { ReactMic, ReactMicStopEvent } from "@cleandersonlobo/react-mic";
import useInterval from "@use-it/interval";
import { Button, Checkbox, Input, Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/functions";
import "firebase/storage";
import React, { useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import * as uuid from "uuid";
import "./Recorder.css";

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
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bio, setBio] = useState<ReactMicStopEvent>();
  const query = new URLSearchParams(useLocation().search);
  const request: Record<string, string> = {};
  query.forEach((value, key) => {
    request[key] = value;
  });

  async function onSubmit() {
    setSubmitting(true);
    const ref = firebase.storage().ref(`/vday/${uuid.v4()}`);
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

  return (
    <div className="vday-record">
      <div>

        <h2>Tell us about your experience with dating apps.</h2>
        <p>We want to know the good, the bad, and the ugly. Or the meh <span role="img" aria-label="shrug-emoji">🤷‍♀️</span></p>
        {recording ? (
          <TimedRecordButton
            stopRecording={() => setRecording(false)}
            minLength={5}
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
          backgroundColor="black"
          strokeColor="white"
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
          <div className="submit-container">
            <p>Almost there!</p>
            <Input className="se-submit-bio" placeholder="First name" />
            <Input className="se-submit-bio" placeholder="Email" />
            <Checkbox className="se-submit-bio">Sign up for email updates from Story Dating</Checkbox>
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
          </div>
        )}
      </div>
    </div>
  );
}

export default Recorder;
