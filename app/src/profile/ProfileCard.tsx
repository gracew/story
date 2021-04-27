import React, {FunctionComponent} from "react";
import "./ProfileCard.css";
import {Photo} from "../components/Photo";

interface ProfileCardProps {
  firstName: string;
  gender: string;
  age?: string | number;
  photoUrl?: string;
  uploading?: boolean;
}

const ProfileCard: FunctionComponent<ProfileCardProps> = (props) => {
  // use the antd Image component to allow enlarging the photo on click
  return (
    <div className="profile-card">
      <div className="profile-card-top">
        <Photo photoUrl={props.photoUrl} uploading={props.uploading}/>
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
