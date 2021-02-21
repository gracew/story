import { Spin } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ProfilePhoto from "./ProfilePhoto";
import "./PublicProfile.css";

function PublicProfile() {
  const [data, setData] = useState<Record<string, any>>();
  const { userId } = useParams();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getPublicProfile")({ userId })
      .then((res) => {
        setData(res.data);
      })
  });

  if (!data) {
    return <Spin size="large" />
  }

  return (
    <div className="public-profile-container">
      <div className="public-profile-header">
        <div>
          <ProfilePhoto photoPath={data.photo} />
          <h1>{data.firstName}</h1>
          <h3>{data.gender}</h3>
          <p>{data.funFacts}</p>
        </div>
      </div>
    </div>

  );
}

export default PublicProfile;
