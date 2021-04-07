import moment from "moment";
import React from "react";
import StoryInput from "../components/StoryInput";
import "./BirthdateInput.css";

interface BirthdateSelection {
  month?: number;
  day?: number;
  year?: number;
}

interface BirthdateInputProps {
  value?: BirthdateSelection;
  update: (birthdate: BirthdateSelection, complete?: boolean) => void;
}

function valid(value: BirthdateSelection) {
  return value.month !== undefined && value.month > 0 && value.month <= 12 &&
    value.day !== undefined && value.day > 0 && value.day <= 31 &&
    value.year !== undefined && value.year > 1900 && !warnMinAge(value);
}

function warnMinAge(value?: BirthdateSelection) {
  if (!value || !value.month || !value.day || !value.year) {
    return false;
  }
  if (value.year < 1900) {
    return false;
  }
  const formatted = `${value.year}-${value.month}-${value.day}`;
  return moment().diff(formatted, "years") < 18;
}

function BirthdateInput(props: BirthdateInputProps) {
  function onMonth(s?: string) {
    if (!s || isNaN(parseInt(s))) {
      props.update({ ...props.value, month: undefined }, false);
      return;
    }
    const month = parseInt(s);
    if (month <= 0 || month > 12) {
      props.update({ ...props.value, month: undefined }, false);
      return;
    }
    const newValue = { ...props.value, month };
    props.update(newValue, valid(newValue));
    if (month >= 2 || s.length === 2) {
      const nextField = document.querySelector("input[id=birthdate-input-d]");
      if (nextField) {
        // @ts-ignore
        nextField.focus();
      }
    }
  }

  function onDay(s?: string) {
    if (!s || isNaN(parseInt(s))) {
      props.update({ ...props.value, day: undefined }, false);
      return;
    }
    const day = parseInt(s);
    if (day <= 0 && day > 31) {
      props.update({ ...props.value, day: undefined }, false);
      return;
    }
    const newValue = { ...props.value, day };
    props.update(newValue, valid(newValue));
    if (day >= 4 || s.length === 2) {
      const nextField = document.querySelector("input[id=birthdate-input-y]");
      if (nextField) {
        // @ts-ignore
        nextField.focus();
      }
    }
  }

  function onYear(s: string) {
    if (!s || isNaN(parseInt(s))) {
      props.update({ ...props.value, year: undefined }, false);
      return;
    }
    const year = parseInt(s);
    const newValue = { ...props.value, year };
    props.update(newValue, valid(newValue));
  }

  return (
    <div>
      <div className="birthdate-input">
        <StoryInput
          type="number"
          id="birthdate-input-m"
          placeholder="MM"
          maxLength={2}
          value={props.value?.month}
          onChange={e => onMonth(e.target.value)}
          autoFocus
        />
      /
        <StoryInput
          type="number"
          id="birthdate-input-d"
          placeholder="DD"
          maxLength={2}
          value={props.value?.day}
          onChange={e => onDay(e.target.value)}
        />
      /
        <StoryInput
          type="number"
          id="birthdate-input-y"
          placeholder="YYYY"
          maxLength={4}
          value={props.value?.year}
          onChange={e => onYear(e.target.value)}
        />
      </div>
      {warnMinAge(props.value) && <div className="min-age">You must be 18 years or older.</div>}
    </div>

  );
}

export default BirthdateInput;