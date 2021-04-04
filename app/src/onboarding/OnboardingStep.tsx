import { Radio } from "antd";
import React, { useEffect, useState } from "react";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import StoryInput from "../components/StoryInput";
import StoryRadioGroup from "../components/StoryRadioGroup";
import StoryTextArea from "../components/StoryTextArea";
import BirthdayInput from "./BirthdayInput";
import { OnboardingMetadata, OnboardingType } from "./Onboarding";
import "./OnboardingStep.css";
import PhotoUpload from "./PhotoUpload";
import SocialVerification from "./SocialVerification";

interface OnboardingStepProps {
  step: OnboardingMetadata;
  update: (u: Record<string, any>) => void;
  back?: () => void;
}

function OnboardingStep(props: OnboardingStepProps) {
  const [value, setValue] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue(undefined);

  }, [props.step]);

  function onMultipleChoiceSelect(option: string) {
    if (value === option) {
      setValue(undefined);
    } else {
      setValue(option);
    }
  }

  function onNext() {
    setSubmitting(true);
    props.update({ [props.step.id]: value });
    setSubmitting(false);
  }

  return (
    <div className="onboarding-step-container">
      <div className="onboarding-step-input">
        <h3>{props.step.label}</h3>
        {props.step.description && <div className="onboarding-step-description" dangerouslySetInnerHTML={{ __html: props.step.description }}></div>}

        {props.step.type === OnboardingType.SHORT_TEXT &&
          <StoryInput placeholder={props.step.placeholder} value={value} onChange={e => setValue(e.target.value)} />}
        {props.step.type === OnboardingType.FREE_TEXT &&
          <StoryTextArea value={value} onChange={e => setValue(e.target.value)} />}
        {props.step.type === OnboardingType.BIRTHDAY &&
          <BirthdayInput />}
        {props.step.type === OnboardingType.PHOTO &&
          <PhotoUpload />}

        {props.step.type === OnboardingType.MULTIPLE_CHOICE &&
          <StoryRadioGroup>
            {props.step.options!.map((o: any) => (
              <Radio
                key={o}
                value={o}
                onClick={() => onMultipleChoiceSelect(o)}
              >{o}</Radio>))}
          </StoryRadioGroup>}

        {props.step.type === OnboardingType.SOCIAL &&
          <SocialVerification />}
      </div>

      <StoryButtonContainer>
        {props.back && <StoryButton
          className="onboarding-step-back"
          type="default"
          onClick={props.back}
        >
          Back
        </StoryButton>}
        <StoryButton
          className="onboarding-step-next"
          type="primary"
          onClick={onNext}
        >
          Next
        </StoryButton>
      </StoryButtonContainer>
    </div >

  );
}

export default OnboardingStep;

