import { RightOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React from "react";
import "./Preference.css";

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

  const className = props.id === "funFacts" ? "pref-fun-facts" : "pref";
  return (
    <Button type="text" className="pref-block-arrow" onClick={onClick}>
      <div className="pref-block">
        <div className={className}>
          <div className="pref-description">
            {props.label}
          </div>
          {props.id !== "funFacts" && <Typography.Text className="pref-value" ellipsis={true}>{formatValue()}</Typography.Text>}
          {props.id === "funFacts" && <div className="pref-value">{props.value}</div>}
        </div>
        {props.dealbreakers && props.dealbreakers.length > 0 && (
          <div className="pref dealbreaker">
            <div>Dealbreakers</div>
            <div className="pref-value">
              {props.dealbreakers.map(t => <div><Typography.Text className="dealbreaker-value" ellipsis={true}>{t}</Typography.Text></div>)}
            </div>
          </div>
        )}
      </div>
      <RightOutlined className="pref-arrow" />
    </Button>
  );
}

export default Preference;
