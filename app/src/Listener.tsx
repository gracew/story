import * as firebase from "firebase/app";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import "./Listener.css";
const uuid = require("uuid");

function Listener() {
  const [bioUrl, setBioUrl] = useState();
  const { bioId } = useParams();
  const query = new URLSearchParams(useLocation().search);

  useEffect(() => {
    firebase
      .storage()
      .ref(`/bios/${bioId}`)
      .getDownloadURL()
      .then((url) => setBioUrl(url));
  });

  return (
    <div>
      <h2>Lucky you!</h2>
      <p>Tonight, you'll be talking to {query.get("name")}.</p>
      <audio className="se-audio-bio" controls src={bioUrl} />
      <p>
        After your call, you can choose to share your phone number with Minh.
      </p>
      <p>Happy chatting!</p>
    </div>
  );
}

export default Listener;
