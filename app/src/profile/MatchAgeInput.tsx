import React from "react";
import StoryInputNumber from "../components/StoryInputNumber";
import "./MatchAgeInput.css";

interface MatchAgeInputProps {
  matchMin?: number;
  matchMax?: number;
  updateMatchMin: (matchMin?: number) => void;
  updateMatchMax: (matchMax?: number) => void;
}

function MatchAgeInput(props: MatchAgeInputProps) {
  function onMatchMin(s?: string | number | null) {
    if (!s) {
      props.updateMatchMin(undefined);
      return;
    }
    const min = typeof s === "number" ? s : parseInt(s);
    props.updateMatchMin(min);
  }

  function onMatchMax(s?: string | number | null) {
    if (!s) {
      props.updateMatchMax(undefined);
      return;
    }
    const min = typeof s === "number" ? s : parseInt(s);
    props.updateMatchMax(min);
  }

  return (
    <div className="match-age-input">
      <StoryInputNumber
        id="match-age-input-min"
        min={18}
        max={99}
        value={props.matchMin}
        onChange={onMatchMin}
        autoFocus
      />
      -
      <StoryInputNumber
        id="match-age-input-max"
        min={18}
        max={99}
        value={props.matchMax}
        onChange={onMatchMax}
      />
    </div>
  );
}

export default MatchAgeInput;