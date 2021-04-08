import React from "react";
import StoryInput from "../components/StoryInput";
import "./MatchAgeInput.css";

interface MatchAgeInputProps {
  matchMin?: number;
  matchMax?: number;
  updateMatchMin: (matchMin?: number) => void;
  updateMatchMax: (matchMax?: number) => void;
}

function MatchAgeInput(props: MatchAgeInputProps) {
  return (
    <div>
      <div className="match-age-input">
        <StoryInput
          type="number"
          id="match-age-input-min"
          maxLength={2}
          value={props.matchMin}
          autoFocus
        />
      -
        <StoryInput
          type="number"
          id="match-age-input-max"
          maxLength={2}
          value={props.matchMax}
        />
      </div>
    </div>

  );
}

export default MatchAgeInput;