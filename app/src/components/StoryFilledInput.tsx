import { Input, InputProps } from "antd";
import React, { FunctionComponent } from "react";
import "./StoryFilledInput.css";

const StoryInput: FunctionComponent<InputProps> = (props) => {
  const { className, ...otherProps } = props;
  return <Input {...otherProps} className={`st-filled-input ${className}`} />;
}

export default StoryInput;
