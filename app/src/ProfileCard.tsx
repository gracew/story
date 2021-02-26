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
      <div className="profile-photo-container">
        {props.photoPath && <Image
          src={photoUrl}
          preview={{ mask: "" }}
          className="profile-photo"
        />}
        {!props.uploading && !props.photoPath && <UserOutlined className="profile-photo-placeholder" />}
      </div>
      <div className="profile-text">
        <h1>{props.firstName}</h1>
        <div>{props.gender}, {props.age}</div>
      </div>
    </div>
  );
}

export default ProfileCard;
