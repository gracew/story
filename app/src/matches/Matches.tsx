import { LeftOutlined, PhoneOutlined, RightOutlined, VideoCameraOutlined } from "@ant-design/icons";
import moment from "moment-timezone";
import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Resources } from "../../../api/responses";
import { getUpcomingMatches } from "../apiClient";
import CenteredSpin from "../components/CenteredSpin";
import StoryButton from "../components/StoryButton";

// TODO: WIP
export default function Matches(): JSX.Element {
  const history = useHistory();
  const [upcomingMatches, setUpcomingMatches] = useState<Resources.UpcomingMatch[]>();
  const [pageIndex, setPageIndex] = useState<number>(0);

  useEffect(() => {
    (async () => {
     setUpcomingMatches(await getUpcomingMatches());
    })();
  }, []);

  if (!upcomingMatches) {
    return <CenteredSpin />;
  }
  if (upcomingMatches.length === 0) {
    history.push("/profile")
  }

  const thisMatch = upcomingMatches[pageIndex];
  let icon;
  switch (thisMatch.mode) {
    case "video":
      icon = <VideoCameraOutlined />;
      break;
    case "phone":
      icon = <PhoneOutlined />;
      break;
  }

  return (
    <div>
      <h5>{thisMatch.firstName}</h5>
      <div>{"San Hardcoded, CA"}</div>
      {icon} &nbsp;
      {moment(thisMatch.meetingTime).format('MMMM D YYYY [at] h:mm A')}

      <div>
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

function toPageNo(i: number) {
  return i + 1;
}