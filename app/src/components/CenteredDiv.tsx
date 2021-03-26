import React, { FunctionComponent, HTMLAttributes } from "react";
import "./CenteredDiv.css";

const CenteredDiv: FunctionComponent<HTMLAttributes<HTMLDivElement>> = (props) => {
  return <div {...props} className="centered-div">
    {props.children}
  </div>;
}

export default CenteredDiv;
