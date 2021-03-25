import { Radio, RadioGroupProps } from "antd";
import React, { FunctionComponent } from "react";
import "./StoryRadioGroup.css";

const StoryRadioGroup: FunctionComponent<RadioGroupProps> = (props) => {
  const { className, ...otherProps } = props;
  return <Radio.Group {...otherProps} className={`st-radio-group ${className}`}>{props.children}</Radio.Group>;
}

export default StoryRadioGroup;
