import React from "react";
import { useHistory, useLocation } from "react-router-dom";
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
      <div>
        <h3 className="onboarding-complete-header">Woohoo, you're on the waitlist!</h3>
        <div className="section">
          <div className="section-header">
            Look out for a confirmation text from us
            </div>
          <div>
            We just texted you at {phone} to confirm your spot. We'll text you again when we have a match for you!
            </div>
        </div>

        <div className="section">
          <div className="section-header">We're just a text away</div>
          <div>
            Questions? Product feedback? Just reply to the number you get our texts from - our team reads and responds 
            to every message <span role="img" aria-label="emoji-blush">😊</span>
          </div>
        </div>

        <div className="section">
          <div className="section-header">Tell your friends about a better way to date</div>
          <div>
            The more friends you refer with your custom link, the sooner you'll be off the
            waitlist!
            </div>
        </div>

        <ReferralCard referrerId={userId} />

      </div>

      <StoryButtonContainer>
        <StoryButton className="see-profile" type="primary" onClick={() => history.push("/profile")}>See my profile</StoryButton>
      </StoryButtonContainer>
    </div >
  );
}

export default OnboardingComplete;