import { Button, Checkbox, Radio, Slider, Spin } from "antd";
import TextArea from "antd/lib/input/TextArea";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import "./EditPreference.css";
import Header from "./Header";

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
  const { userId } = useParams();

  function emptyState() {
    if (props.metadata.type === PreferenceType.AGE) {
      return matchMin === undefined && matchMax === undefined;
    }
    const emptyValue = value === undefined || (Array.isArray(value) && value.length === 0);
    const emptyDealbreakers = props.metadata.dealbreakers ? (!dealbreakers || dealbreakers.length === undefined || dealbreakers.length === 0) : true;
    return emptyValue && emptyDealbreakers;
  }

  function valueHandleOther() {
    if (value && props.metadata.type === PreferenceType.MULTIPLE_CHOICE && !props.metadata.options.includes(value as string)) {
      return "Other";
    }
    const optionsSet = new Set(props.metadata.options);
    if (Array.isArray(value)) {
      return value.map(v => optionsSet.has(v) ? v : "Other")
    }
    return value;
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
      } else if (value === undefined) {
        setValue([option])
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
    if (userId) {
      update.userId = userId;
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
    <div className="edit-preference-container">
      <div>

        <Header />
        <div className="edit-preference">
          <h3>{props.metadata.label}</h3>
          {props.metadata.dealbreakers && <div className="edit-prefs-header">About me</div>}
          {props.metadata.description && <div className="edit-pref-description" dangerouslySetInnerHTML={{ __html: props.metadata.description }}></div>}

          {props.metadata.type === PreferenceType.FREE_TEXT && <TextArea value={value} onChange={e => setValue(e.target.value)} allowClear autoSize={{ minRows: 6 }} />}
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
            {props.metadata.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE &&
              <div>
                <p className="multiple-selection-desc">Choose as many as you like</p>
                <Checkbox.Group value={valueHandleOther() as string[] | undefined}>
                  {props.metadata.options.map(o => (
                    <Checkbox
                      value={o}
                      className="pref-option"
                      onClick={() => onMultipleChoiceSelect(o)}
                    >{o}</Checkbox>
                  ))}
                  {props.metadata.allowOther && <div>
                    <Checkbox
                      value="Other"
                      className="pref-option"
                      onClick={() => onMultipleChoiceSelect("Other")}
                    >Other</Checkbox>
                  </div>
                  }
                </Checkbox.Group>
              </div>
            }
            {props.metadata.type === PreferenceType.MULTIPLE_CHOICE &&
              <Radio.Group value={valueHandleOther()}>
                {props.metadata.options.map(o => (
                  <Radio
                    value={o}
                    className="pref-option"
                    onClick={() => onMultipleChoiceSelect(o)}
                  >{o}</Radio>
                ))}
                {props.metadata.allowOther && <div>
                  <Radio
                    value="Other"
                    className="pref-option"
                    onClick={() => onMultipleChoiceSelect("Other")}
                  >Other</Radio>
                </div>
                }
              </Radio.Group>
            }
          </div>

          {props.metadata.dealbreakers &&
            <div>
              <div className="edit-prefs-header-dealbreakers">Match dealbreakers</div>
              <p className="multiple-selection-desc">Choose as many as you like</p>
              <div className="pref-options">
                <Checkbox.Group value={dealbreakers}>
                  {(props.metadata.dealbreakerOptions || props.metadata.options).map(o => (
                    <Checkbox
                      value={o}
                      className="pref-option"
                      onChange={() => onDealbreakerSelect(o)}
                    >{o}</Checkbox>
                  ))}
                  <Checkbox
                    value={NO_DEALBREAKERS}
                    className="pref-option"
                    onChange={() => onDealbreakerSelect(NO_DEALBREAKERS)}
                  >{NO_DEALBREAKERS}</Checkbox>
                </Checkbox.Group>
              </div>
            </div>
          }
        </div>
      </div>

      <div className="edit-actions">
        <Button className="edit-cancel" onClick={props.back}>Cancel</Button>
        <Button className="edit-save" type="primary" onClick={onSave} disabled={emptyState() || saving}>
          {!saving && <div>Save</div>}
          {saving && <div>Saving... <Spin size="small" ></Spin></div>}
        </Button>
      </div>
    </div>
  );
}

export default EditPreference;
