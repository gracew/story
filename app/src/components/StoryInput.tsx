import { Input, InputProps } from "antd";
import React, { FunctionComponent } from "react";
import "./StoryInput.css";

const StoryInput: FunctionComponent<InputProps> = (props) => {
  const { className, ...otherProps } = props;
  return <Input {...otherProps} className={`st-input ${className}`} bordered={false} />;
}

export default StoryInput;
