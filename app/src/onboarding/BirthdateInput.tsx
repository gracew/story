import moment from "moment";
import React, { useState } from "react";
import StoryInput from "../components/StoryInput";
import "./BirthdateInput.css";

interface BirthdateInputProps {
  update: (birthdate?: string) => void;
}

function isValidNumber(v: string) {
  return !isNaN(parseInt(v));
}

function getDate(value: Array<string>) {
  if (!value.every(v => isValidNumber(v))) {
    return undefined;
  }
  const month = value.slice(0, 2).join("");
  const day = value.slice(2, 4).join("");
  const year = value.slice(4).join("");
  return `${year}-${month}-${day}`;
}

function BirthdateInput(props: BirthdateInputProps) {
  const [value, setValue] = useState(new Array(8));

  function onChange(v: string, i: number) {
    const newValue = [...value]
    newValue[i] = v;
    setValue(newValue);
    props.update(getDate(newValue));
    if (i !== 7 && isValidNumber(v)) {
      // Get the next input field
      const nextField = document.querySelector(`input[name=birthdate-input-${i + 1}]`);
      // If found, focus the next field
      if (nextField) {
        // @ts-ignore
        nextField.focus();
      }
    }
  }

  function onKeyDown(keyCode: number, i: number) {
    if (keyCode === 8 && (value[i] === undefined || value[i] === "") && i > 0) {
      // backspace
      const prevField = document.querySelector(`input[name=birthdate-input-${i - 1}]`);
      // If found, focus the prev field
      if (prevField) {
        // @ts-ignore
        prevField.focus();
      }
    }
  }

  return (
    <div>
      <div className="birthdate-input">
        <StoryInput
          name="birthdate-input-0"
          placeholder="M"
          maxLength={1}
          value={value[0]}
          onChange={e => onChange(e.target.value, 0)}
          onKeyDown={e => onKeyDown(e.keyCode, 0)}
          autoFocus
        />
        <StoryInput
          name="birthdate-input-1"
          placeholder="M"
          maxLength={1}
          value={value[1]}
          onChange={e => onChange(e.target.value, 1)}
          onKeyDown={e => onKeyDown(e.keyCode, 1)}
        />
      /
        <StoryInput
          name="birthdate-input-2"
          placeholder="D"
          maxLength={1}
          value={value[2]}
          onChange={e => onChange(e.target.value, 2)}
          onKeyDown={e => onKeyDown(e.keyCode, 2)}
        />
        <StoryInput
          name="birthdate-input-3"
          placeholder="D"
          maxLength={1}
          value={value[3]}
          onChange={e => onChange(e.target.value, 3)}
          onKeyDown={e => onKeyDown(e.keyCode, 3)}
        />
      /
        <StoryInput
          name="birthdate-input-4"
          placeholder="Y"
          maxLength={1}
          value={value[4]}
          onChange={e => onChange(e.target.value, 4)}
          onKeyDown={e => onKeyDown(e.keyCode, 4)}
        />
        <StoryInput
          name="birthdate-input-5"
          placeholder="Y"
          maxLength={1}
          value={value[5]}
          onChange={e => onChange(e.target.value, 5)}
          onKeyDown={e => onKeyDown(e.keyCode, 5)}
        />
        <StoryInput
          name="birthdate-input-6"
          placeholder="Y"
          maxLength={1}
          value={value[6]}
          onChange={e => onChange(e.target.value, 6)}
          onKeyDown={e => onKeyDown(e.keyCode, 6)}
        />
        <StoryInput
          name="birthdate-input-7"
          placeholder="Y"
          maxLength={1}
          value={value[7]}
          onChange={e => onChange(e.target.value, 7)}
          onKeyDown={e => onKeyDown(e.keyCode, 7)}
        />
      </div>
      {getDate(value) && moment().diff(getDate(value), "years") < 18 && <div className="min-age">You must be 18 years or older.</div>}
    </div>

  );
}

export default BirthdateInput;