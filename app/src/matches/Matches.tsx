import { LeftOutlined, PhoneOutlined, RightOutlined, VideoCameraOutlined } from "@ant-design/icons";
import firebase from "firebase";
import moment from "moment-timezone";
import React, { useEffect, useState } from "react";
import { Resources } from "../../../api/functions";
import { getUpcomingMatches } from "../apiClient";
import CenteredDiv from "../components/CenteredDiv";
import CenteredSpin from "../components/CenteredSpin";
import StoryButton from "../components/StoryButton";
import ProfileCard from "../profile/ProfileCard";
import "./Matches.css";

export default function Matches(): JSX.Element {
  const [upcomingMatches, setUpcomingMatches] = useState<Resources.UpcomingMatch[]>();
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>();

  useEffect(() => {
    (async () => {
      setUpcomingMatches(await getUpcomingMatches());
    })();
  }, []);

  useEffect(() => {
    if (!upcomingMatches || !upcomingMatches[pageIndex] || !upcomingMatches[pageIndex].photo) {
      setPhotoUrl(undefined);
      return;
    }
    firebase
      .storage()
      .ref(upcomingMatches[pageIndex].photo)
      .getDownloadURL()
      .then(url => setPhotoUrl(url));
  }, [upcomingMatches, pageIndex]);

  if (!upcomingMatches) {
    return <CenteredSpin />;
  }
  if (upcomingMatches.length === 0) {
    return <CenteredDiv>We don't have a match for you this week. We'll text you as soon as we do!</CenteredDiv>;
  }

  const thisMatch = upcomingMatches[pageIndex];
  const icon = thisMatch.mode === "video" ? <VideoCameraOutlined /> : <PhoneOutlined />;

  return (
    <div className="matches">
      <div className="match-card-container">
        <ProfileCard firstName={thisMatch.firstName} gender={thisMatch.gender} photoUrl={photoUrl}>
          <div className="match-details">
            <div className="match-time">
              {icon}{moment(thisMatch.meetingTime).format('ddd, MMM D [at] h:mm A')}
            </div>
            <p>{thisMatch.funFacts}</p>
          </div>
        </ProfileCard>
      </div>

      <div className="matches-slider">
        <StoryButton
          disabled={pageIndex < 1}
          type="primary"
          shape="circle"
          onClick={() => setPageIndex(i => i - 1)}
        >
          <LeftOutlined />
        </StoryButton>

        <div>{pageIndex + 1}</div>
        <div>/</div>
        <div>{upcomingMatches.length}</div>

        <StoryButton
          disabled={pageIndex >= upcomingMatches.length - 1}
          shape="circle"
          type="primary"
          onClick={() => setPageIndex(i => i + 1)}
        >
          <RightOutlined />
        </StoryButton>
      </div>
    </div>
  );
}
