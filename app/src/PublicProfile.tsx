import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CenteredSpin from "./CenteredSpin";
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
    return <CenteredSpin />
  }

  return (
    <div className="public-profile-container">
      <div>
        <ProfileCard firstName={data.firstName} gender={data.gender} photoPath={data.photo}>
          <p className="public-profile-fun-facts">{data.funFacts}</p>
        </ProfileCard>
      </div>
    </div>

  );
}

export default PublicProfile;
