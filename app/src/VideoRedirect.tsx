import { Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
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
      .finally(() => {
        window.location.href = `https://meet.google.com/${videoId}`
      });
  });

  return <Spin size="large" />;
}

export default VideoRedirect;
