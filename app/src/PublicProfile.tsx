import { Spin } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ProfileCard from "./ProfileCard";
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
  }, [userId]);

  if (!data) {
    return <Spin size="large" />
  }

  return (
    <div className="public-profile-container">
      <div className="public-profile-header">
        <div>
          <ProfileCard firstName={data.firstName} gender={data.gender} photoPath={data.photo} />
          <p>{data.funFacts}</p>
        </div>
      </div>
    </div>

  );
}

export default PublicProfile;
