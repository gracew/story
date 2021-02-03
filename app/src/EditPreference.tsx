import { Button, Slider } from "antd";
import TextArea from "antd/lib/input/TextArea";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React from "react";
import "./EditPreference.css";

export enum PreferenceType {
  FREE_TEXT,
  MULTIPLE_CHOICE,
  MULTIPLE_CHOICE_ALLOW_MULTIPLE,
  AGE,
}

export interface EditPreferenceProps {
  label: string,
  type: PreferenceType,
  description?: string,
  dealbreakers?: boolean,
  options: string[],
  selected?: string | string[],
  selectedDealbreakers?: string[],
  allowOther?: boolean;
  minAge?: number,
  maxAge?: number,
  back: () => void;
}

function EditPreference(props: EditPreferenceProps) {
  function isSelected(option: string) {
    if (props.type === PreferenceType.MULTIPLE_CHOICE) {
      return option === props.selected;
    }
    return props.selected?.includes(option);

  }
  return (
    <div className="profile-container">
      <div className="prefs-header">
        <h1>{props.label}</h1>
      </div>

      <h3 className="prefs-header">About me</h3>
      {props.description && <p>{props.description}</p>}

      {props.type === PreferenceType.FREE_TEXT && <TextArea value={props.selected} allowClear />}
      {props.type === PreferenceType.AGE && <Slider range min={18} max={65} tooltipVisible defaultValue={[props.minAge!, props.maxAge!]} />}

      <div className="pref-options">
        {props.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE && <p className="multiple-selection-desc">Choose as many as you like</p>}
        {(props.type === PreferenceType.MULTIPLE_CHOICE || props.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE) &&
          <div>
            {props.options.map(o => (
              <Button className="pref-option" shape="round" type={isSelected(o) ? "primary" : "default"}>{o}</Button>
            ))}
          </div>
        }
        {props.allowOther && <Button className="pref-option" shape="round" type={isSelected("Other") ? "primary" : "default"}>Other</Button>}
      </div>

      {props.dealbreakers &&
        <div>
          <h3 className="prefs-header">Match dealbreakers</h3>
          <p className="multiple-selection-desc">Choose as many as you like</p>
          <div className="pref-options">
            {props.options.map(o => (
              <Button className="pref-option" shape="round" type={props.selectedDealbreakers?.includes(o) ? "primary" : "default"}>{o}</Button>
            ))}
            <Button className="pref-option" shape="round" type={props.selectedDealbreakers?.includes("None of these are dealbreakers") || props.selectedDealbreakers?.length === 0 ? "primary" : "default"}>None of these are dealbreakers</Button>
          </div>
        </div>
      }


      <div className="save-cancel">
        <Button type="primary" onClick={props.back}>Save</Button>
        <Button onClick={props.back}>Cancel</Button>
      </div>

    </div>
  );
}

export default EditPreference;
