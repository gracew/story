import { Button, Slider, Spin } from "antd";
import TextArea from "antd/lib/input/TextArea";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useState } from "react";
import "./EditPreference.css";

export enum PreferenceType {
  FREE_TEXT,
  MULTIPLE_CHOICE,
  MULTIPLE_CHOICE_ALLOW_MULTIPLE,
  AGE,
}

interface PreferenceMetadata {
  id: string;
  label: string,
  type: PreferenceType,
  description?: string,
  options: string[],
  allowOther?: boolean;
  dealbreakers?: boolean,
  dealbreakerOptions?: string[],
}

export interface EditPreferenceProps {
  metadata: PreferenceMetadata;

  // initial values
  value?: string | string[],
  dealbreakers?: string[],
  matchMin?: number,
  matchMax?: number,

  update: (u: Record<string, any>) => void;
  back: () => void;
}

const NO_DEALBREAKERS = "None of these are dealbreakers";

function EditPreference(props: EditPreferenceProps) {
  const [value, setValue] = useState(props.value);
  const [dealbreakers, setDealbreakers] = useState(props.dealbreakers);
  const [matchMin, setMatchMin] = useState(props.matchMin);
  const [matchMax, setMatchMax] = useState(props.matchMax);
  const [saving, setSaving] = useState(false);

  function isSelected(option: string) {
    if (props.metadata.type === PreferenceType.MULTIPLE_CHOICE) {
      return option === value;
    }
    return Array.isArray(value) && value.includes(option);
  }

  function otherSelected() {
    if (value === undefined) {
      return false;
    }
    if (props.metadata.type === PreferenceType.MULTIPLE_CHOICE) {
      return !props.metadata.options.includes(value as string);
    }
    const optionsSet = new Set(props.metadata.options);
    return Array.isArray(value) && !value.some(v => optionsSet.has(v));
  }

  function onMultipleChoiceSelect(option: string) {
    if (props.metadata.type === PreferenceType.MULTIPLE_CHOICE) {
      if (value === option) {
        setValue(undefined);
      } else {
        setValue(option);
      }
    } else if (props.metadata.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE) {
      if (Array.isArray(value)) {
        if (value.includes(option)) {
          const i = value.indexOf(option);
          setValue(value.slice(0, i).concat(value.slice(i + 1)));
        } else {
          setValue([...value, option])
        }
      }
    }
  }

  function onDealbreakerSelect(option: string) {
    let dbs = dealbreakers || [];
    if (dbs.includes(NO_DEALBREAKERS)) {
      // if any option is selected, remove NO_DEALBREAKERS
      const i = dbs.indexOf(NO_DEALBREAKERS);
      dbs = dbs.slice(0, i).concat(dbs.slice(i + 1));
    }

    if (dbs.includes(option)) {
      const i = dbs.indexOf(option);
      setDealbreakers(dbs.slice(0, i).concat(dbs.slice(i + 1)));
    } else if (option === NO_DEALBREAKERS) {
      setDealbreakers([option]);
    } else {
      setDealbreakers([...dbs, option])
    }
  }

  function onSave() {
    setSaving(true);
    const update: Record<string, any> = {};
    if ((value && value !== props.value) || (dealbreakers && dealbreakers !== props.dealbreakers)) {
      if (props.metadata.dealbreakers) {
        update[props.metadata.id] = { value, dealbreakers };
      } else {
        update[props.metadata.id] = { value };
      }
    }
    if (matchMin !== undefined && matchMin !== props.matchMin) {
      update.matchMin = matchMin;
    }
    if (matchMax !== undefined && matchMax !== props.matchMax) {
      update.matchMax = matchMax;
    }
    firebase
      .functions()
      .httpsCallable("savePreferences")(update)
      .then((res) => {
        setSaving(false);
        props.update(update)
        props.back();
      })
  }

  return (
    <div className="profile-container">
      <h1>{props.metadata.label}</h1>

      <div className="edit-preference">
        {props.metadata.dealbreakers && <h3>About me</h3>}
        {props.metadata.description && <div className="edit-pref-description" dangerouslySetInnerHTML={{ __html: props.metadata.description }}></div>}

        {props.metadata.type === PreferenceType.FREE_TEXT && <TextArea value={value} onChange={e => setValue(e.target.value)} allowClear autoSize={{ minRows: 4 }} />}
        {props.metadata.type === PreferenceType.AGE && <Slider
          className="edit-pref-age"
          range
          min={18}
          max={65}
          tooltipVisible
          defaultValue={[matchMin!, matchMax!]}
          onChange={([min, max]) => { setMatchMin(min); setMatchMax(max); }}
        />}

        <div className="pref-options">
          {props.metadata.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE && <p className="multiple-selection-desc">Choose as many as you like</p>}
          {(props.metadata.type === PreferenceType.MULTIPLE_CHOICE || props.metadata.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE) &&
            <div>
              {props.metadata.options.map(o => (
                <Button
                  className="pref-option"
                  shape="round"
                  type={isSelected(o) ? "primary" : "default"}
                  onClick={() => onMultipleChoiceSelect(o)}
                >{o}</Button>
              ))}
            </div>
          }
          {props.metadata.allowOther && <div>
            <Button
              className="pref-option"
              shape="round"
              type={otherSelected() ? "primary" : "default"}
              onClick={() => onMultipleChoiceSelect("Other")}
            >Other</Button>
          </div>
          }
        </div>

        {props.metadata.dealbreakers &&
          <div>
            <h3 className="prefs-header">Match dealbreakers</h3>
            <p className="multiple-selection-desc">Choose as many as you like</p>
            <div className="pref-options">
              {(props.metadata.dealbreakerOptions || props.metadata.options).map(o => (
                <Button
                  className="pref-option"
                  shape="round"
                  type={dealbreakers?.includes(o) ? "primary" : "default"}
                  onClick={() => onDealbreakerSelect(o)}
                >{o}</Button>
              ))}
              <Button
                className="pref-option"
                shape="round"
                type={dealbreakers?.includes(NO_DEALBREAKERS) ? "primary" : "default"}
                onClick={() => onDealbreakerSelect(NO_DEALBREAKERS)}
              >{NO_DEALBREAKERS}</Button>
            </div>
          </div>
        }
      </div>

      <div className="save-cancel">
        <Button onClick={props.back}>Cancel</Button>
        <Button type="primary" onClick={onSave} disabled={saving}>
          {!saving && <div>Save</div>}
          {saving && <div>Saving... <Spin size="small" ></Spin></div>}
        </Button>
      </div>

    </div>
  );
}

export default EditPreference;
