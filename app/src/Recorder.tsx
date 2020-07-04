import * as firebase from "firebase/app";
import "firebase/functions";
import "firebase/storage";
import React, { useState } from "react";
import { ReactMic } from "react-mic";
import { useLocation } from "react-router-dom";
import "./App.css";
const uuid = require("uuid");

function Recorder() {
  const [record, setRecord] = useState(false);
  const query = new URLSearchParams(useLocation().search);
  const request = {
    firstName: query.get("name"),
    gender: "female",
    phone: query.get("phone"),
  };

  function onStop(blob: any) {
    console.log(blob);
    const ref = firebase.storage().ref(`/bios/${uuid.v4()}`);
    return ref.put(blob.blob).then(() =>
      firebase.functions().httpsCallable("registerUser")({
        ...request,
        bio: ref.fullPath,
      })
    );
  }

  return (
    <div>
      <ReactMic record={record} onStop={onStop} />
      <button onClick={() => setRecord(true)} type="button">
        Start
      </button>
      <button onClick={() => setRecord(false)} type="button">
        Stop
      </button>
    </div>
  );
}

export default Recorder;
