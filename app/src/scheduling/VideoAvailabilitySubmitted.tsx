import React from "react";
import { useHistory } from "react-router-dom";
import CenteredDiv from "../components/CenteredDiv";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import "./VideoAvailabilitySubmitted.css";

function VideoAvailabilitySubmitted() {
  const history = useHistory();

  return (
    <div className="video-availability-submitted">
      <CenteredDiv>
        <div>
          <h3>Thanks!</h3>
          <div>When we hear back from your match we'll text you about the time of the video date ️✌️</div>
        </div>
      </CenteredDiv>
      <StoryButtonContainer>
        <StoryButton
          className="back-to-profile"
          type="primary"
          onClick={() => history.push("/profile")}
        >
          Back to my profile
        </StoryButton>
      </StoryButtonContainer>
    </div>

  );
}

export default VideoAvailabilitySubmitted;
