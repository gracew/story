import { UserOutlined } from "@ant-design/icons";
import { Image } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import "./ProfileCard.css";

interface ProfileCardProps {
  firstName: string;
  gender: string;
  age?: string | number;
  photoPath?: string;
  uploading?: boolean;
}

function ProfileCard(props: ProfileCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string>();

  useEffect(() => {
    if (props.photoPath) {
      firebase
        .storage()
        .ref(props.photoPath)
        .getDownloadURL()
        .then((url) => setPhotoUrl(url));
    }
  });

  return (
    <div className="profile-card">
      <div className="profile-card-top">
        <div className="profile-photo-container">
          {props.photoPath && <Image
            src={photoUrl}
            preview={{ mask: "" }}
            className="profile-photo"
          />}
          {!props.uploading && !props.photoPath && <UserOutlined className="profile-photo-placeholder" />}
        </div>
        <div className="profile-text">
          <h3>{props.firstName}</h3>
          <div>{props.gender}, {props.age}</div>
        </div>
      </div>
      <div className="profile-card-bottom">Your photo will only be shown after your phone call.</div>
    </div>
  );
}

export default ProfileCard;
