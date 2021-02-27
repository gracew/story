import { UserOutlined } from "@ant-design/icons";
import { Image } from "antd";
import firebase from "firebase";
import React, { FunctionComponent, useEffect, useState } from "react";
import "./ProfileCard.css";

interface ProfileCardProps {
  firstName: string;
  gender: string;
  age?: string | number;
  photoPath?: string;
  uploading?: boolean;
}

const ProfileCard: FunctionComponent<ProfileCardProps> = (props) => {
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
          <div>{props.gender}{props.age && `, ${props.age}`}</div>
        </div>
      </div>
      {props.children}
    </div>
  );
}

export default ProfileCard;
