import firebase from "firebase";
import React, { useState } from "react";
import { Redirect, useParams } from "react-router-dom";
import { FUN_FACTS_DESCRIPTION, LOCATIONS } from "../profile/Profile";
import OnboardingStep from "./OnboardingStep";

export enum OnboardingType {
  FREE_TEXT,
  SHORT_TEXT,
  MULTIPLE_CHOICE,
  PHOTO,
  BIRTHDAY,
  SOCIAL,
}

export interface OnboardingMetadata {
  id: string;
  label: string;
  type: OnboardingType;
  placeholder?: string;
  description?: string;
  options?: string[];
}

const steps: OnboardingMetadata[] = [
  {
    id: "whereDidYouHearAboutUs",
    label: "How did you find out about us?",
    type: OnboardingType.MULTIPLE_CHOICE,
    options: ["Twitter", "Instagram", "Facebook", "TikTok", "Friend", "Other"],
  },
  {
    id: "firstName",
    label: "My first name is...",
    type: OnboardingType.SHORT_TEXT,
    description: "This is how your name will appear on Story Dating and you will not be able to change it.",
    placeholder: "First name",
  },
  {
    id: "birthdate",
    label: "My birthday is...",
    type: OnboardingType.BIRTHDAY,
    description: "Your birthday is used to calculate your age and is not shared. Your age may be shared with your matches.",
  },
  {
    id: "pronouns",
    label: "My pronouns are...",
    type: OnboardingType.MULTIPLE_CHOICE,
    options: ["He/him", "She/her", "They/them"],
  },
  {
    id: "connectionType",
    label: "I am looking for these types of connections...",
    type: OnboardingType.MULTIPLE_CHOICE,
    options: ["Serious dating", "Casual dating", "Open to either"],
  },
  {
    id: "genderPreference",
    label: "I am interested in...",
    type: OnboardingType.MULTIPLE_CHOICE,
    options: ["Men", "Women", "Everyone"],
  },
  {
    id: "location",
    label: "I live in...",
    type: OnboardingType.MULTIPLE_CHOICE,
    options: LOCATIONS,
  },
  {
    id: "interests",
    label: "I am passionate about...",
    type: OnboardingType.FREE_TEXT,
    description: "Tell us about some of your interests and hobbies — this will help us with picking your matches!",
  },
  {
    id: "photo",
    label: "Add a photo of yourself",
    type: OnboardingType.PHOTO,
    description: "Choose a photo of just you where your face is clearly visible. You can change this later.",
  },
  {
    id: "funFacts",
    label: "What are 3 fun facts about you?",
    type: OnboardingType.FREE_TEXT,
    description: FUN_FACTS_DESCRIPTION,
  },
  {
    id: "social",
    label: "Final verification!",
    type: OnboardingType.SOCIAL,
    description: "Prove to us that you're a real person by providing a social media handle. This is used only by the Story Dating team and won't be shown to your matches.",
  },
]

function Onboarding() {
  // @ts-ignore
  const { step } = useParams();
  const [userId, setUserId] = useState<string>();
  const [phone, setPhone] = useState<string>();
  const [data, setData] = useState<Record<string, any>>({});
  const [stepIndex, setStepIndex] = useState(step || 0);

  if (stepIndex >= steps.length) {
    const redirectProps = {
      pathname: "/signup/complete",
      state: { id: userId, phone },
    }
    return <Redirect to={redirectProps} />
  }

  async function onBack() {
    setStepIndex(stepIndex - 1);
  }

  async function onNext(update: Record<string, any>) {
    const res = await firebase.functions().httpsCallable("onboardUser")(update)
    setUserId(res.data.id);
    setPhone(res.data.phone);
    setData({ ...data, ...update });
    setStepIndex(stepIndex + 1);
  }

  return (
    <OnboardingStep
      step={steps[stepIndex]}
      update={onNext}
      value={data[steps[stepIndex].id]}
      back={stepIndex > 0 ? onBack : undefined}
    />
  );
}

export default Onboarding;

