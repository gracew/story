import { InputNumber, InputNumberProps } from "antd";
import React, { FunctionComponent } from "react";
import "./StoryInputNumber.css";

const StoryInputNumber: FunctionComponent<InputNumberProps> = (props) => {
  const { className, ...otherProps } = props;
  return <InputNumber {...otherProps} className={`st-input-number ${className}`} />;
}

export default StoryInputNumber;
