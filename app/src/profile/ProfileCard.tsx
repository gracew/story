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
  footer?: React.ReactNode;
  noPhotoIcon?: React.ReactNode;
}

const ProfileCard: FunctionComponent<ProfileCardProps> = (props) => {
  // use the antd Image component to allow enlarging the photo on click
  const noPhotoIcon = props.noPhotoIcon || <UserOutlined />;
  return (
    <div className="profile-card">
      <div className="profile-card-inner">
        <div className="profile-card-top">
          <div className="profile-photo-container">
            {props.photoUrl && <Image
              src={props.photoUrl}
              preview={{ mask: "" }}
              className="profile-photo"
            />}
            {!props.uploading && !props.photoUrl && <div className="profile-photo-placeholder">{noPhotoIcon}</div>}
          </div>
          <div className="profile-text">
            <h3>{props.firstName}</h3>
            <div>{props.gender}{props.age && `, ${props.age}`}</div>
          </div>
        </div>
        {props.children}
      </div>
      {props.footer}
    </div>
  );
}

export default ProfileCard;
