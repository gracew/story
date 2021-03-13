import React, { FunctionComponent, HTMLAttributes } from "react";
import "./StoryButtonContainer.css";

const StoryButtonContainer: FunctionComponent<HTMLAttributes<HTMLDivElement>> = (props) => {
  return <div {...props} className="button-container">{props.children}</div>;
}

export default StoryButtonContainer;
