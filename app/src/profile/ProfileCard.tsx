import { UserOutlined } from "@ant-design/icons";
import { Image } from "antd";
import React, { FunctionComponent } from "react";
import "./ProfileCard.css";

interface ProfileCardProps {
  firstName: string;
  gender: string;
  age?: string | number;
  photoUrl?: string;
  uploading?: boolean;
}

const ProfileCard: FunctionComponent<ProfileCardProps> = (props) => {
  return (
    <div className="profile-card">
      <div className="profile-card-top">
        <div className="profile-photo-container">
          {props.photoUrl && <Image
            src={props.photoUrl}
            preview={{ mask: "" }}
            className="profile-photo"
          />}
          {!props.uploading && !props.photoUrl && <UserOutlined className="profile-photo-placeholder" />}
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
