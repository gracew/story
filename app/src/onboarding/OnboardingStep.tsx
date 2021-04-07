import { Radio } from "antd";
import React from "react";
import StoryInput from "../components/StoryInput";
import StoryRadioGroup from "../components/StoryRadioGroup";
import StoryTextArea from "../components/StoryTextArea";
import BirthdateInput from "./BirthdateInput";
import ChannelInput from "./ChannelInput";
import LocationInput from "./LocationInput";
import { OnboardingMetadata, OnboardingType } from "./Onboarding";
import "./OnboardingStep.css";
import PhotoUpload from "./PhotoUpload";
import SocialVerification from "./SocialVerification";

interface OnboardingStepProps {
  step: OnboardingMetadata;
  value?: any;
  update: (u: any, complete?: boolean) => void;
}

function OnboardingStep(props: OnboardingStepProps) {
  return (
    <div className="onboarding-step">
      <h3>{props.step.label}</h3>
      {props.step.description && <div className="onboarding-step-description" dangerouslySetInnerHTML={{ __html: props.step.description }}></div>}

      {props.step.type === OnboardingType.SHORT_TEXT &&
        <StoryInput
          placeholder={props.step.placeholder}
          value={props.value}
          onChange={e => props.update(e.target.value)}
          autoFocus
        />}
      {props.step.type === OnboardingType.FREE_TEXT &&
        <StoryTextArea value={props.value} onChange={e => props.update(e.target.value)} autoFocus />}
      {props.step.type === OnboardingType.BIRTHDAY &&
        <BirthdateInput value={props.value} update={props.update} />}
      {props.step.type === OnboardingType.PHOTO &&
        <PhotoUpload value={props.value} update={props.update} />}
      {props.step.type === OnboardingType.CHANNEL &&
        <ChannelInput value={props.value} update={props.update} />}
      {props.step.type === OnboardingType.LOCATION &&
        <LocationInput value={props.value} update={props.update} />}

      {props.step.type === OnboardingType.MULTIPLE_CHOICE &&
        <StoryRadioGroup value={props.value}>
          {props.step.options!.map((o: any) => (
            <Radio
              key={o}
              value={o}
              onClick={() => props.update(o)}
            >{o}</Radio>))}
        </StoryRadioGroup>}

      {props.step.type === OnboardingType.SOCIAL &&
        <SocialVerification value={props.value} update={props.update} />}
    </div>
  );
}

export default OnboardingStep;

