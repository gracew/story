import { Checkbox, Radio } from "antd";
import React, { useEffect, useState } from "react";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import StoryCheckboxGroup from "../components/StoryCheckboxGroup";
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
  const [value, setValue] = useState<string | string[]>();

  useEffect(() => {
    setValue(undefined);

  }, [props.step]);

  function onMultipleChoiceSelect(option: string) {
    if (props.step.type === OnboardingType.MULTIPLE_CHOICE) {
      if (value === option) {
        setValue(undefined);
      } else {
        setValue(option);
      }
    } else if (props.step.type === OnboardingType.MULTIPLE_CHOICE_ALLOW_MULTIPLE) {
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

        {props.step.type === OnboardingType.MULTIPLE_CHOICE_ALLOW_MULTIPLE &&
          <StoryCheckboxGroup value={value as string[]}>
            {props.step.options!.map((o: any) => (
              <Checkbox
                key={o}
                value={o}
                onClick={() => onMultipleChoiceSelect(o)}
              >{o}</Checkbox>))}
          </StoryCheckboxGroup>}

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
          onClick={() => props.update({ [props.step.id]: value })}
        >
          Next
        </StoryButton>
      </StoryButtonContainer>
    </div >

  );
}

export default OnboardingStep;

