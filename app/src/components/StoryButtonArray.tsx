import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { FunctionComponent, HTMLAttributes } from "react";
import "./StoryButton.css";

const StoryButtonArray: FunctionComponent<HTMLAttributes<HTMLButtonElement>> = (props) => {
  return <div className="st-button-array">{props.children}</div>;
}

export default StoryButtonArray;
