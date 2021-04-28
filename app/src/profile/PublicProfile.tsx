import firebase from "firebase";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CenteredSpin from "../components/CenteredSpin";
import ProfileCard from "./ProfileCard";
import "./PublicProfile.css";

function PublicProfile() {
  const [data, setData] = useState<Record<string, any>>();
  const [photoUrl, setPhotoUrl] = useState<string>();
  const { userId } = useParams();

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getPublicProfile")({ userId })
      .then((res) => {
        setData(res.data);
        if (res.data.photo) {
          firebase
            .storage()
            .ref(res.data.photo)
            .getDownloadURL()
            .then((url) => setPhotoUrl(url));
        }
      })
  }, [userId]);

  if (!data) {
    return <CenteredSpin />
  }

  return (
    <div className="public-profile-container">
      <ProfileCard firstName={data.firstName} gender={data.gender} photoUrl={photoUrl}>
        <p>{data.funFacts}</p>
      </ProfileCard>
    </div>

  );
}

export default PublicProfile;
