import { Button, Spin, Typography } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./Preference.css";
import { RightOutlined } from "@ant-design/icons";

interface PreferenceProps {
  id: string;
  label: string;
  value?: boolean | string | string[];
  dealbreakers?: string[],
  onSelect: (label: string) => void;
}
function Preference(props: PreferenceProps) {

  function formatValue() {
    if (typeof props.value === "boolean") {
      return props.value ? "Yes" : "No";
    }
    if (Array.isArray(props.value)) {
      return props.value.map(t => (<div>{t}</div>))
    }
    return props.value;
  }
  function onClick() {
    props.onSelect(props.id);
  }

  return (
    <Button type="text" className="pref-block-arrow" onClick={onClick}>
      <div className="pref-block">
        <div className="pref">
          <div className="pref-description">
            {props.label}
          </div>
          <Typography.Text className="pref-value" ellipsis={true}>{formatValue()}</Typography.Text>
        </div>
        {props.dealbreakers && props.dealbreakers.length > 0 && (
          <div className="pref">
            <div className="dealbreaker-label">
              <div>Dealbreakers</div>
            </div>
            <div className="pref-value">
              {props.dealbreakers.map(t => <div><Typography.Text className="dealbreaker" ellipsis={true}>{t}</Typography.Text></div>)}
            </div>
          </div>
        )}
      </div>
      <RightOutlined className="pref-arrow" />
    </Button>
  );
}

export default Preference;
