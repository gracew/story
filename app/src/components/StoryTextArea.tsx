import { TextAreaProps } from "antd/lib/input";
import TextArea from "antd/lib/input/TextArea";
import React, { FunctionComponent } from "react";
import "./StoryTextArea.css";

const StoryTextArea: FunctionComponent<TextAreaProps> = (props) => {
  const { className, ...otherProps } = props;
  return <TextArea
    className={`st-text-area ${className}`}
    allowClear
    autoSize={{ minRows: 6 }}
    {...otherProps}
  ></TextArea>;
}

export default StoryTextArea;
