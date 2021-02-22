import { Spin } from "antd";
import "firebase/analytics";
import firebase from "firebase/app";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect } from "react";
import { useParams } from "react-router-dom";

function VideoRedirect() {
  // @ts-ignore
  const { videoId, user } = useParams();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("markJoined")({ videoId, user })
      .then((res) => {
        window.location.href = res.data.redirect;
      })
  });

  return <Spin size="large" />;
}

export default VideoRedirect;
