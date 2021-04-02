import React from "react";
import { useHistory } from "react-router-dom";
import CenteredDiv from "../components/CenteredDiv";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import "./OnboardingComplete.css";

function OnboardingComplete() {
  const history = useHistory();

  return (
    <div className="onboarding-complete">
      <CenteredDiv>
        <div>
          <h3 className="onboarding-complete-header">Your profile is complete!</h3>
          <div className="section">
            <div className="section-header">
              Once you're off the waitlist, our matchmakers will text you for your availability so we can schedule a
              phone call with your match.
            </div>
            <div>
              In the meantime, if you have any other preferences we should know, just text us
              <span role="img" aria-label="emoji-blush">😊</span>
            </div>
          </div>

          <div className="section">
            <div className="section-header">You can always opt out - but please don't flake</div>
            <div>
              Life happens, and we understand if your schedule changes! If you need to cancel or reschedulue, just
              send us a text.
            </div>
          </div>

          <div className="section">
            <div className="section-header">We're always here if you need help</div>
            <div>
              If you ever feel uncomfortable with a match or have a negative experience, text us and we'll step in.
              We take safety extremely seriously and we'll have your back.
            </div>
          </div>
        </div>
      </CenteredDiv>

      <StoryButtonContainer>
        <StoryButton className="see-profile" type="primary" onClick={() => history.push("/profile")}>See my profile</StoryButton>
      </StoryButtonContainer>
    </div >
  );
}

export default OnboardingComplete;