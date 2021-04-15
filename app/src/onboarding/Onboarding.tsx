import firebase from "firebase";
import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import { FUN_FACTS_DESCRIPTION } from "../profile/Profile";
import "./Onboarding.css";
import OnboardingStep from "./OnboardingStep";
import CenteredSpin from "../components/CenteredSpin";
import {getPreferences, NotFound} from "../apiClient";

export enum OnboardingType {
  FREE_TEXT,
  SHORT_TEXT,
  MULTIPLE_CHOICE,
  PHOTO,
  BIRTHDAY,
  SOCIAL,
  CHANNEL,
  LOCATION,
}

function getExistingValue(userPrefs: Record<string, any>, step: OnboardingMetadata) {
  return step.getValue ? step.getValue(userPrefs) : userPrefs[step.id];
}

export interface OnboardingMetadata {
  id: string;
  label: string;
  type: OnboardingType;
  getValue?(user: Record<string, any>): string | undefined;
  placeholder?: string;
  description?: string;
  options?: string[];
}

const steps: OnboardingMetadata[] = [
  {
    id: "whereDidYouHearAboutUs",
    label: "How did you find out about us?",
    type: OnboardingType.CHANNEL,
  },
  {
    id: "firstName",
    label: "My first name is...",
    type: OnboardingType.SHORT_TEXT,
    description: "This is how your name will appear on Story Dating.",
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
    getValue(user: Record<string, any>): string | undefined {
      return user.connectionType?.value;
    }
  },
  {
    id: "genderPreference",
    label: "I am interested in...",
    type: OnboardingType.MULTIPLE_CHOICE,
    options: ["Men", "Women", "Everyone"],
    getValue(user: Record<string, any>): string | undefined {
      return user.genderPreference?.value;
    }
  },
  {
    id: "location",
    label: "I live in...",
    type: OnboardingType.LOCATION,
    getValue(user: Record<string, any>): string | undefined {
      return user.location?.value;
    }
  },
  {
    id: "interests",
    label: "I am passionate about...",
    type: OnboardingType.FREE_TEXT,
    description: "Tell us about some of your interests and hobbies — this will help us with picking your matches!",
  },
  {
    id: "photo",
    label: "Add a profile photo",
    type: OnboardingType.PHOTO,
    description: "This is shown to your match after the phone call, so choose a photo of just you where your face is clearly visible.",
  },
  {
    id: "funFacts",
    label: "What are 3 fun facts about you?",
    type: OnboardingType.FREE_TEXT,
    description: FUN_FACTS_DESCRIPTION,
    getValue(user: Record<string, any>): string | undefined {
      return user.funFacts?.value;
    }
  },
  {
    id: "social",
    label: "One last thing -",
    type: OnboardingType.SOCIAL,
    description: "Prove to us that you're a real person by providing a social media handle. This is used only by the Story Dating team and won't be shown to your matches.",
  },
]

function Onboarding() {
  const { step } = useParams();
  const history = useHistory();
  const [maybeUserPrefs, setMaybeUserPrefs] = useState<Record<string, any> | typeof NotFound>();
  const [userId, setUserId] = useState<string>();
  const [phone, setPhone] = useState<string>();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [complete, setComplete] = useState<Record<string, any>>({});
  const [stepIndex, setStepIndex] = useState(step || 0);
  const [submitting, setSubmitting] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const referrer = urlParams.get("r");

  useEffect(() => {
    (async () => {
      setMaybeUserPrefs(await getPreferences());
    })().catch(console.error)
  }, [])

  useEffect(() => {
    if (!maybeUserPrefs || maybeUserPrefs === NotFound) {
      return;
    }
    const userPrefs = maybeUserPrefs;
    const existingValueByStepId = Object.fromEntries(
      steps.map(step => [step.id, getExistingValue(userPrefs, step)]));
    setFormData(formData => ({...formData, ...existingValueByStepId}));
  }, [maybeUserPrefs]);

  useEffect(() => {
    if (userId) {
      firebase.analytics().setUserId(userId);
    }
  }, [userId])

  useEffect(() => {
    const stepId = steps[stepIndex].id;
    firebase.analytics().setCurrentScreen("onboarding_" + stepId)
  }, [stepIndex])

  async function onUpdate(update: any, updateComplete?: boolean) {
    const stepId = steps[stepIndex].id;
    setFormData({ ...formData, [stepId]: update });
    setComplete({ ...complete, [stepId]: updateComplete });
  }

  async function onBack() {
    const stepId = steps[stepIndex].id;
    firebase.analytics().logEvent(`onboarding_${stepId}_back`);

    setStepIndex(stepIndex - 1);
  }

  async function onNext() {
    setSubmitting(true);

    const stepId = steps[stepIndex].id;
    firebase.analytics().logEvent(`onboarding_${stepId}_next`);

    const res = await firebase.functions().httpsCallable("onboardUser")({ [stepId]: formData[stepId], referrer })
    setUserId(res.data.id);
    setPhone(res.data.phone);

    if (stepIndex === steps.length - 1) {
      history.push("/signup/complete", { id: userId, phone });
    } else {
      setStepIndex(stepIndex + 1);
    }

    setSubmitting(false);
  }

  function isThisStepIncomplete() {
    const stepId = steps[stepIndex].id;
    const value = formData[stepId];
    return complete[stepId] === false || value === undefined || value === "";
  }

  if (!maybeUserPrefs) {
    return <CenteredSpin />;
  }

  if (maybeUserPrefs !== NotFound && maybeUserPrefs.onboardingComplete) {
    history.push("/profile");
  }

  return (
    <div className="onboarding">
      <OnboardingStep
        step={steps[stepIndex]}
        update={onUpdate}
        value={formData[steps[stepIndex].id]}
      />
      <StoryButtonContainer>
        {stepIndex > 0 && <StoryButton
          className="onboarding-step-back"
          type="default"
          onClick={onBack}
        >
          Back
        </StoryButton>}
        <StoryButton
          className="onboarding-step-next"
          type="primary"
          onClick={onNext}
          disabled={isThisStepIncomplete()}
          loading={submitting}
        >
          Next
        </StoryButton>
      </StoryButtonContainer>
    </div>
  );
}

export default Onboarding;

