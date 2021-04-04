import React from "react";
import { useHistory, useLocation } from "react-router-dom";
import CenteredDiv from "../components/CenteredDiv";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import ReferralCard from "../profile/ReferralCard";
import "./OnboardingComplete.css";

function OnboardingComplete() {
  const history = useHistory();
  const location = useLocation();
  const userId = (location.state as any)?.id;
  const phone = (location.state as any)?.phone;

  return (
    <div className="onboarding-complete">
      <CenteredDiv>
        <div>
          <h3 className="onboarding-complete-header">Your profile is complete!</h3>
          <div className="section">
            <div className="section-header">
              Look out for a confirmation text from us
            </div>
            <div>
              We just texted you at {phone} to confirm your spot on the waitlist. We'll be back in touch as soon as we
              have a match for you!
            </div>
          </div>

          <div className="section">
            <div className="section-header">We're just a text away</div>
            <div>
              Questions? Preferences that aren't covered by our web app? Just reply to the confirmation text - our
              team reads and responds to every message <span role="img" aria-label="emoji-blush">😊</span>
            </div>
          </div>

          <div className="section">
            <div className="section-header">Refer your friends</div>
            <div>
              Tell your friends about a better way to date. The more friends you refer, the sooner you'll be off the 
              waitlist!
            </div>
          </div>

          <ReferralCard referrerId={userId} />

        </div>
      </CenteredDiv>

      <StoryButtonContainer>
        <StoryButton className="see-profile" type="primary" onClick={() => history.push("/profile")}>See my profile</StoryButton>
      </StoryButtonContainer>
    </div >
  );
}

export default OnboardingComplete;