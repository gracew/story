import { Checkbox, Radio } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import StoryCheckboxGroup from "../components/StoryCheckboxGroup";
import StoryRadioGroup from "../components/StoryRadioGroup";
import StoryTextArea from "../components/StoryTextArea";
import "./EditPreference.css";
import MatchAgeInput from "./MatchAgeInput";

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
  // @ts-ignore
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
      } else if (!value) {
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
    <div className="edit-preference">
      <div className="edit-preference-input-container">
        <div className="edit-preference-input">
          <h3>{props.metadata.label}</h3>
          {props.metadata.dealbreakers && <div className="edit-prefs-header">About me</div>}
          {props.metadata.description && <div className="edit-pref-description" dangerouslySetInnerHTML={{ __html: props.metadata.description }}></div>}

          {props.metadata.type === PreferenceType.FREE_TEXT && <StoryTextArea value={value} onChange={e => setValue(e.target.value)} />}
          {props.metadata.type === PreferenceType.AGE && <MatchAgeInput
            matchMin={matchMin}
            matchMax={matchMax}
            updateMatchMin={setMatchMin}
            updateMatchMax={setMatchMax}
          />}

          <div className="pref-options">
            {props.metadata.type === PreferenceType.MULTIPLE_CHOICE_ALLOW_MULTIPLE &&
              <div>
                <StoryCheckboxGroup value={valueHandleOther() as string[] | undefined}>
                  {props.metadata.options.map(o => (
                    <Checkbox
                      key={o}
                      value={o}
                      onClick={() => onMultipleChoiceSelect(o)}
                    >{o}</Checkbox>
                  ))}
                  {props.metadata.allowOther && <div>
                    <Checkbox
                      value="Other"
                      onClick={() => onMultipleChoiceSelect("Other")}
                    >Other</Checkbox>
                  </div>
                  }
                </StoryCheckboxGroup>
              </div>
            }
            {props.metadata.type === PreferenceType.MULTIPLE_CHOICE &&
              <StoryRadioGroup value={valueHandleOther()}>
                {props.metadata.options.map(o => (
                  <Radio
                    key={o}
                    value={o}
                    onClick={() => onMultipleChoiceSelect(o)}
                  >{o}</Radio>
                ))}
                {props.metadata.allowOther && <div>
                  <Radio
                    value="Other"
                    onClick={() => onMultipleChoiceSelect("Other")}
                  >Other</Radio>
                </div>
                }
              </StoryRadioGroup>
            }
          </div>

          {props.metadata.dealbreakers &&
            <div>
              <div className="edit-prefs-header-dealbreakers">Match dealbreakers</div>
              <p className="multiple-selection-desc">These are traits that you would prefer to avoid in your matches.</p>
              <div className="pref-options">
                <StoryCheckboxGroup value={dealbreakers}>
                  {(props.metadata.dealbreakerOptions || props.metadata.options).map(o => (
                    <Checkbox
                      key={o}
                      value={o}
                      onChange={() => onDealbreakerSelect(o)}
                    >{o}</Checkbox>
                  ))}
                  <Checkbox
                    value={NO_DEALBREAKERS}
                    onChange={() => onDealbreakerSelect(NO_DEALBREAKERS)}
                  >{NO_DEALBREAKERS}</Checkbox>
                </StoryCheckboxGroup>
              </div>
            </div>
          }
        </div>
      </div>

      <StoryButtonContainer>
        <StoryButton
          className="edit-preference-cancel"
          onClick={props.back}
        >Cancel</StoryButton>
        <StoryButton
          className="edit-preference-save"
          type="primary"
          onClick={onSave}
          disabled={emptyState()}
          loading={saving}
        >Save</StoryButton>
      </StoryButtonContainer>
    </div>
  );
}

export default EditPreference;
