import { LeftOutlined, PhoneOutlined, RightOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import firebase from "firebase";
import moment from "moment-timezone";
import React, { useEffect, useState } from "react";
import { Resources } from "../../../api/functions";
import { getUpcomingMatches } from "../apiClient";
import CenteredDiv from "../components/CenteredDiv";
import CenteredSpin from "../components/CenteredSpin";
import StoryButton from "../components/StoryButton";
import StoryModal from "../components/StoryModal";
import ProfileCard from "../profile/ProfileCard";
import "./Matches.css";
import RescheduleModal from "./RescheduleModal";

enum ModalType {
  RESCHEDULE,
  CANCEL_CONFIRM,
}

export default function Matches(): JSX.Element {
  const [upcomingMatches, setUpcomingMatches] = useState<Resources.UpcomingMatch[]>();
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [modal, setModal] = useState<ModalType>();
  const [commonAvailability, setCommonAvailability] = useState<Date[]>([]);
  const timezone = "America/Los_Angeles";

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

  useEffect(() => {
    // TODO: call getCommonAvailability
    setCommonAvailability([
      new Date("2021-04-27T19:00:00-07:00"),
      new Date("2021-04-27T20:00:00-07:00"),
      new Date("2021-04-28T20:00:00-07:00"),
    ]);
  }, []);

  if (!upcomingMatches) {
    return <CenteredSpin />;
  }
  if (upcomingMatches.length === 0) {
    return <CenteredDiv>We don't have a match for you this week. We'll text you as soon as we do!</CenteredDiv>;
  }

  const thisMatch = upcomingMatches[pageIndex];
  function onReschedule(date: Date) {
    // TODO: call rescheduleMatch
    setModal(undefined);
    const formattedTime = moment(date).tz(timezone).format("ha dddd");
    Modal.success({
      className: "story-info-modal",
      title: "You're all set!",
      content: `Your call with ${thisMatch.firstName} has been rescheduled for ${formattedTime}.`,
    });
  }

  function onCancelMatchConfirm() {
    // TODO: call cancelMatch 
    setModal(undefined);
    Modal.success({
      className: "story-info-modal",
      title: "You're all set.",
      content: "Thanks for letting us know ahead of time. We'll notify your match that the call is canceled.",
    });
  }

  return (
    <div className="matches">
      <div className="match-card-container">
        <ProfileCard
          firstName={thisMatch.firstName}
          gender={thisMatch.gender}
          photoUrl={photoUrl}
          footer={<Button className="match-reschedule" onClick={() => setModal(ModalType.RESCHEDULE)}>Reschedule</Button>}
        >
          <div className="match-details">
            <div className="match-time">
              {thisMatch.mode === "video" ? <VideoCameraOutlined /> : <PhoneOutlined />}
              {moment(thisMatch.meetingTime).format('ddd, MMM D [at] h:mm A')}
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

      {/* modals */}
      <RescheduleModal
        visible={modal === ModalType.RESCHEDULE && commonAvailability.length > 0}
        timeOptions={commonAvailability}
        timezone="America/Los_Angeles"
        matchName={thisMatch.firstName}
        onReschedule={onReschedule}
        onCancelMatch={() => setModal(ModalType.CANCEL_CONFIRM)}
        onCancel={() => setModal(undefined)}
      />
      <StoryModal
        visible={modal === ModalType.RESCHEDULE && commonAvailability.length === 0}
        okText="Yes, cancel"
        onOk={onCancelMatchConfirm}
        cancelText="Keep this call"
        onCancel={() => setModal(undefined)}
      >
        <div>Looks like you both aren't free later this week. Do you want to cancel your call with {thisMatch.firstName}?</div>
      </StoryModal>

      <StoryModal
        visible={modal === ModalType.CANCEL_CONFIRM}
        okText="Yes, cancel"
        onOk={onCancelMatchConfirm}
        cancelText="Keep this call"
        onCancel={() => setModal(undefined)}
      >
        <div>Are you sure you want to cancel your call with {thisMatch.firstName}?</div>
      </StoryModal>
    </div>
  );
}