import { UserOutlined } from "@ant-design/icons";
import { Image } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import "./ProfilePhoto.css";

interface ProfilePhotoProps {
  photoPath?: string;
  uploading?: boolean;
}

function ProfilePhoto(props: ProfilePhotoProps) {
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
    <div className="profile-photo-container">
      {props.photoPath && <Image
        src={photoUrl}
        preview={{ mask: "" }}
        className="profile-photo"
      />}
      {!props.uploading && !props.photoPath && <UserOutlined className="profile-photo-placeholder" />}
    </div>
  );
}

export default ProfilePhoto;
