import { Checkbox } from "antd";
import { CheckboxGroupProps } from "antd/lib/checkbox";
import React, { FunctionComponent } from "react";
import "./StoryCheckboxGroup.css";

const StoryCheckboxGroup: FunctionComponent<CheckboxGroupProps> = (props) => {
  const { className, ...otherProps } = props;
  return <Checkbox.Group {...otherProps} className={`st-checkbox-group ${className}`}>{props.children}</Checkbox.Group>;
}

export default StoryCheckboxGroup;
