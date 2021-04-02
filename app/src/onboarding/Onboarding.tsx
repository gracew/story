import React, { useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { FUN_FACTS_DESCRIPTION, LOCATIONS } from "../profile/Profile";
import OnboardingStep from "./OnboardingStep";

export enum OnboardingType {
  FREE_TEXT,
  SHORT_TEXT,
  MULTIPLE_CHOICE,
  MULTIPLE_CHOICE_ALLOW_MULTIPLE,
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
    id: "relationshipType",
    label: "I am looking for a...",
    type: OnboardingType.MULTIPLE_CHOICE_ALLOW_MULTIPLE,
    options: ["Serious relationship", "Casual relationship"],
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
  const history = useHistory();
  const [data, setData] = useState<Record<string, any>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(step || 0);

  if (stepIndex >= steps.length) {
    history.push("/signup/complete")
  }

  async function onBack() {
    setStepIndex(stepIndex - 1);
  }

  async function onNext() {
    setSubmitting(true);
    setStepIndex(stepIndex + 1);
    setSubmitting(false);
    // TODO: fix this
    // await firebase.functions().httpsCallable("saveOnboarding")({ id: currStep!.id, selection })
  }

  return (
    <OnboardingStep
      step={steps[stepIndex]}
      update={onNext}
      back={stepIndex > 0 ? onBack : undefined}
    />
  );
}

export default Onboarding;

