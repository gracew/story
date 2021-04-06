import { Radio } from "antd";
import React from "react";
import StoryInput from "../components/StoryInput";
import StoryRadioGroup from '../components/StoryRadioGroup';
import { LOCATIONS } from "../profile/Profile";

interface LocationInputProps {
  value?: string;
  update: (value?: string, complete?: boolean) => void;
}

function LocationInput(props: LocationInputProps) {
  function selectedValue() {
    if (!props.value) {
      return undefined;
    }
    return LOCATIONS.includes(props.value) ? props.value : "Other";
  }

  return (
    <div>
      <StoryRadioGroup value={selectedValue()}>
        {LOCATIONS.map((o: any) => (
          <Radio
            key={o}
            value={o}
            onClick={() => props.update(o, true)}
          >{o}</Radio>))}
        <Radio
          value="Other"
          onClick={() => props.update("Other", false)}
        >Other</Radio>
      </StoryRadioGroup>

      {props.value && !LOCATIONS.includes(props.value) &&
        <div>
          <StoryInput
            onChange={e => props.update(e.target.value, e.target.value.length > 0)}
            value={props.value !== "Other" ? props.value : ""}
            autoFocus
          />
        </div>
      }
    </div>
  );
}

export default LocationInput;
