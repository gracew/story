import {Image} from "antd";
import {UserOutlined} from "@ant-design/icons";
import React from "react";
import "./Photo.css"

export function Photo(props: { photoUrl: string | undefined, uploading?: boolean}) {
  return <div className="photo-container">
    {props.photoUrl && <Image
        src={props.photoUrl}
        preview={{mask: ""}}
        className="photo"
    />}
    {!props.uploading && !props.photoUrl && <UserOutlined className="photo-placeholder"/>}
  </div>;
}