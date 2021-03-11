import { Button } from "antd";
import { ButtonProps, ButtonType } from "antd/lib/button";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { FunctionComponent } from "react";
import "./StoryButton.css";

export interface StoryButtonProps {
  onClick?: () => void;
  type?: ButtonType;
}

const StoryButton: FunctionComponent<StoryButtonProps & ButtonProps> = (props) => {
  const { className, ...otherProps } = props;
  return <Button {...otherProps} className={`st-button ${className}`}>{props.children}</Button>;
}

export default StoryButton;
