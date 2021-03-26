import { Spin } from "antd";
import React from "react";
import "./CenteredSpin.css";

function CenteredSpin() {
  return <div className="centered-spin">
    <Spin size="large" />
  </div>
}

export default CenteredSpin;
