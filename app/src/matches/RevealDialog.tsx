import { Button } from "antd";
import React, { useState } from "react";
import { saveRating, saveReveal } from "../apiClient";
import StoryButtonContainer from "../components/StoryButtonContainer";
import "./RevealDialog.css";

enum RevealDialogStep {
  REVEAL,
  RATING,
  COMPLETE,
}

interface RevealDialogProps {
  matchId: string;
  matchName: string;
  closeDialog: () => void;
}

function RevealDialog(props: RevealDialogProps) {
  const [step, setStep] = useState(RevealDialogStep.REVEAL);
  const [reveal, setReveal] = useState<boolean>();
  const [rating, setRating] = useState<number>();

  const [revealLoading, setRevealLoading] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  async function onSaveReveal(value: boolean) {
    setReveal(value);
    setRevealLoading(true);
    await saveReveal({ matchId: props.matchId, reveal: value});
    setRevealLoading(false);
    setStep(RevealDialogStep.RATING);
  }

  async function onSaveRating() {
    setRatingLoading(true);
    await saveRating({ matchId: props.matchId, rating: rating! });
    setRatingLoading(false);
    setStep(RevealDialogStep.COMPLETE);
  }

  function text() {
    if (rating === 1) {
      return "I had a terrible time";
    } else if (rating === 2) {
      return "I did not enjoy the call";
    } else if (rating === 3) {
      return "My call was just okay";
    } else if (rating === 4) {
      return "I liked the call";
    } else if (rating === 5) {
      return "I had an awesome call!";
    }
    return "";
  }

  if (step === RevealDialogStep.REVEAL) {
    return <div className="reveal-dialog">
      Thanks for chatting with {props.matchName}! Would you like to have a second date over video?
    <StoryButtonContainer>
        <Button onClick={() => onSaveReveal(false)} loading={reveal === false && revealLoading}>No thanks</Button>
        <Button onClick={() => onSaveReveal(true)} loading={reveal === true && revealLoading} type="primary">I'm in</Button>
      </StoryButtonContainer>
    </div>;
  }

  if (step === RevealDialogStep.RATING) {
    return <div className="reveal-dialog">
      How did you feel about your call? Feedback is private.
      <div className="rating-options">
        <div>
          <Button type="text" onClick={() => setRating(1)}>
            <span role="img" aria-label="emoji-frowning">🙁</span>
          </Button>
          <Button type="text" onClick={() => setRating(2)}>
            <span role="img" aria-label="emoji-disappointed">😞</span>
          </Button>
          <Button type="text" onClick={() => setRating(3)}>
            <span role="img" aria-label="emoji-neutral">😐</span>
          </Button>
          <Button type="text" onClick={() => setRating(4)}>
            <span role="img" aria-label="emoji-slightly-smiling">🙂</span>
          </Button>
          <Button type="text" onClick={() => setRating(5)}>
            <span role="img" aria-label="emoji-blush">😊</span>
          </Button>
        </div>
        <div className="rating-text">{text()}</div>
      </div>
      <StoryButtonContainer>
        <Button
          type="primary"
          disabled={rating === undefined}
          onClick={onSaveRating}
          loading={ratingLoading}
        >Submit to Story</Button>
      </StoryButtonContainer>
    </div>;
  }

  return <div className="reveal-dialog">
    <p>Thanks! We're learning your type and will use your feedback to help pick your future matches.</p>
    {reveal && <p>We’ll text you about scheduling if {props.matchName} is also interested in video chatting.</p>}
      <StoryButtonContainer>
      <Button href="https://calendly.com/gracew_/match-prefs" target="_blank">Learn more</Button>
      <Button type="primary" onClick={props.closeDialog}>Got it</Button>
    </StoryButtonContainer>
  </div>;
}

export default RevealDialog;
