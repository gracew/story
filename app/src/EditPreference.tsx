import { Button, Input, Slider } from "antd";
import TextArea from "antd/lib/input/TextArea";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React from "react";
import "./EditPreference.css";

export enum PreferenceType {
  FREE_TEXT,
  BOOLEAN,
  MULTIPLE_CHOICE,
  MULTIPLE_CHOICE_ALLOW_MULTIPLE,
  AGE,
}

export interface EditPreferenceProps {
  // metadata
  label: string,
  type: PreferenceType,
  description?: string,
  options: string[],
  dealbreakerOptions?: boolean,
  allowOther?: boolean;

  // user selection
  value?: string | string[] | boolean,
  otherValue?: string;
  dealbreakers?: string[],
  matchMin?: number,
  matchMax?: number,
  back: () => void;
}

function EditPreference(props: EditPreferenceProps) {
  function isSelected(option: string) {
    if (props.type === PreferenceType.MULTIPLE_CHOICE) {
      return option === props.value;
    }
    return Array.isArray(props.value) && props.value.includes(option);
  }

  function noneSelected() {
    if (props.type === PreferenceType.MULTIPLE_CHOICE) {
      return props.options.includes(props.value as string);
    }
    const optionsSet = new Set(props.options);
    return Array.isArray(props.value) && props.value.some(v => optionsSet.has(v));
  }

  return (
    <div className="profile-container">
      <h1>{props.label}</h1>

      <div className="edit-preference">
        {props.dealbreakerOptions && <h3 className="prefs-header">About me</h3>}
        {props.description && <p>{props.description}</p>}

        {props.type === PreferenceType.FREE_TEXT && <TextArea value={props.value as string} allowClear autoSize={{ minRows: 4 }} />}
        {props.type === PreferenceType.AGE && <Slider range min={18} max={65} tooltipVisible defaultValue={[props.matchMin!, props.matchMax!]} />}

        <div className="pref-options">
          {props.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE && <p className="multiple-selection-desc">Choose as many as you like</p>}
          {(props.type === PreferenceType.MULTIPLE_CHOICE || props.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE) &&
            <div>
              {props.options.map(o => (
                <Button className="pref-option" shape="round" type={isSelected(o) ? "primary" : "default"}>{o}</Button>
              ))}
            </div>
          }
          {props.type === PreferenceType.BOOLEAN &&
            <div>
              <Button className="pref-option" shape="round" type={props.value ? "primary" : "default"}>Yes</Button>
              <Button className="pref-option" shape="round" type={!props.value ? "primary" : "default"}>No</Button>
            </div>
          }
          {props.allowOther && <div>
            <Button className="pref-option" shape="round" type={noneSelected() ? "primary" : "default"}>Other</Button>
            <Input value={props.value as string} />
          </div>
          }
        </div>

        {props.dealbreakerOptions &&
          <div>
            <h3 className="prefs-header">Match dealbreakers</h3>
            <p className="multiple-selection-desc">Choose as many as you like</p>
            <div className="pref-options">
              {props.options.map(o => (
                <Button className="pref-option" shape="round" type={props.dealbreakers?.includes(o) ? "primary" : "default"}>{o}</Button>
              ))}
              <Button className="pref-option" shape="round" type={props.dealbreakers?.includes("None of these are dealbreakers") || props.dealbreakers?.length === 0 ? "primary" : "default"}>None of these are dealbreakers</Button>
            </div>
          </div>
        }
      </div>

      <div className="save-cancel">
        <Button type="primary" onClick={props.back}>Save</Button>
        <Button onClick={props.back}>Cancel</Button>
      </div>

    </div>
  );
}

export default EditPreference;
