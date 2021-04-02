import React, { useState } from "react";
import StoryInput from "../components/StoryInput";
import "./BirthdayInput.css";

function BirthdayInput() {
  const [value, setValue] = useState(new Array(6));

  function onChange(v: string, i: number) {
    if (isNaN(parseInt(v))) {
      return;
    }
    const newValue = [...value]
    newValue[i] = v;
    setValue(newValue);
    if (i !== 5) {
      // Get the next input field
      const nextField = document.querySelector(`input[name=birthday-input-${i + 1}]`);
      // If found, focus the next field
      if (nextField) {
        // @ts-ignore
        nextField.focus();
      }
    }
  }

  return (
    <div className="birthday-input">
      <StoryInput name="birthday-input-0" placeholder="M" maxLength={1} value={value[0]} onChange={e => onChange(e.target.value, 0)} />
      <StoryInput name="birthday-input-1" placeholder="M" maxLength={1} value={value[1]} onChange={e => onChange(e.target.value, 1)} />
    /
      <StoryInput name="birthday-input-2" placeholder="D" maxLength={1} value={value[2]} onChange={e => onChange(e.target.value, 2)} />
      <StoryInput name="birthday-input-3" placeholder="D" maxLength={1} value={value[3]} onChange={e => onChange(e.target.value, 3)} />
    /
      <StoryInput name="birthday-input-4" placeholder="Y" maxLength={1} value={value[4]} onChange={e => onChange(e.target.value, 4)} />
      <StoryInput name="birthday-input-5" placeholder="Y" maxLength={1} value={value[5]} onChange={e => onChange(e.target.value, 5)} />
    </div>

  );
}

export default BirthdayInput;