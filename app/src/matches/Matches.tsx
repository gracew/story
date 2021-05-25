import { LeftOutlined, PhoneOutlined, RightOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import firebase from "firebase";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Resources } from "../../../api/functions";
import { cancelMatch, getCommonAvailability, getUpcomingMatches, rescheduleMatch } from "../apiClient";
import CenteredDiv from "../components/CenteredDiv";
import CenteredSpin from "../components/CenteredSpin";
import StoryButton from "../components/StoryButton";
import StoryModal from "../components/StoryModal";
import ProfileCard from "../profile/ProfileCard";
import "./Matches.css";
import RescheduleModal from "./RescheduleModal";
import RevealDialog from "./RevealDialog";

enum ModalType {
  RESCHEDULE,
  CANCEL_CONFIRM,
}

export default function Matches(): JSX.Element {
  const { matchId } = useParams();
  const [upcomingMatches, setUpcomingMatches] = useState<Resources.UpcomingMatch[]>();
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [modal, setModal] = useState<ModalType>();
  const [commonAvailability, setCommonAvailability] = useState<Date[]>([]);
  const [commonAvailabilityLoading, setCommonAvailabilityLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [revealDialogMatch, setRevealDialogMatch] = useState<Resources.UpcomingMatch>();

  useEffect(() => {
    (async () => {
      const res = await getUpcomingMatches();
      setUpcomingMatches(res);
      setRevealDialogMatch(res.find(res => res.requestReveal));
      if (matchId) {
        const index = res.findIndex(m => m.id === matchId);
        if (index >= 0) {
          setPageIndex(index);
        }
      }
    })();
  }, [matchId]);

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

  async function onClickReschedule() {
    setCommonAvailabilityLoading(true);
    const res = await getCommonAvailability({ matchId: thisMatch.id })
    setCommonAvailability(res.commonAvailability);
    setCommonAvailabilityLoading(false);
    setModal(ModalType.RESCHEDULE);
  }

  async function onReschedule(date: Date) {
    setRescheduleLoading(true);
    await rescheduleMatch({ matchId: thisMatch.id, newTime: date.toISOString() });
    setRescheduleLoading(false);

    // update local state
    const newUpcomingMatches = [...upcomingMatches!];
    newUpcomingMatches[pageIndex].meetingTime = date.toISOString();
    newUpcomingMatches.sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime());
    setUpcomingMatches(newUpcomingMatches);
    setPageIndex(0);

    // close reschedule modal
    setModal(undefined);

    // show success modal
    const formattedTime = moment(date).format("ha dddd");
    Modal.success({
      className: "story-info-modal",
      title: "You're all set!",
      content: `Your call with ${thisMatch.firstName} has been rescheduled for ${formattedTime}.`,
    });
  }

  async function onCancelMatchConfirm() {
    setCancelLoading(true);
    await cancelMatch({ matchId: thisMatch.id });
    setCancelLoading(false);

    // update local state
    setUpcomingMatches(upcomingMatches!.filter(m => m.id !== thisMatch.id));
    setPageIndex(0);

    // close cancel confirmation modal
    setModal(undefined);

    // show success modal
    Modal.success({
      className: "story-info-modal",
      title: "You're all set.",
      content: "Thanks for letting us know ahead of time. We'll notify your match that the call is canceled.",
    });
  }

  // if the match is in the future, allow rescheduling
  const footer = moment(thisMatch.meetingTime).diff(moment()) > 0
    ? <Button
      className="match-reschedule"
      loading={commonAvailabilityLoading}
      onClick={onClickReschedule}
    >Reschedule</Button>
    : undefined;

  return (
    <div className="matches">
      {revealDialogMatch && <RevealDialog
        matchId={revealDialogMatch.id}
        matchName={revealDialogMatch.firstName}
        closeDialog={() => setRevealDialogMatch(undefined)}
      />}
      <div className="match-card-container">
        <ProfileCard
          firstName={thisMatch.firstName}
          gender={thisMatch.gender}
          photoUrl={photoUrl}
          footer={footer}
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
        visible={modal === ModalType.RESCHEDULE && !commonAvailabilityLoading && commonAvailability.length > 0}
        timeOptions={commonAvailability}
        matchName={thisMatch.firstName}
        rescheduleLoading={rescheduleLoading}
        onReschedule={onReschedule}
        onCancelMatch={() => setModal(ModalType.CANCEL_CONFIRM)}
        onCancel={() => setModal(undefined)}
      />
      <StoryModal
        visible={modal === ModalType.RESCHEDULE && !commonAvailabilityLoading && commonAvailability.length === 0}
        okText="Yes, cancel"
        onOk={onCancelMatchConfirm}
        okButtonProps={{ loading: cancelLoading }}
        cancelText="Keep this call"
        onCancel={() => setModal(undefined)}
      >
        <p>Looks like you both aren't free later this week. Do you want to cancel your call with {thisMatch.firstName}?</p>
        <p>Canceling will notify your match right away.</p>
      </StoryModal>

      <StoryModal
        visible={modal === ModalType.CANCEL_CONFIRM}
        okText="Yes, cancel"
        onOk={onCancelMatchConfirm}
        okButtonProps={{ loading: cancelLoading }}
        cancelText="Keep this call"
        onCancel={() => setModal(undefined)}
      >
        <p>Are you sure you want to cancel your call with {thisMatch.firstName}?</p>
        <p>Canceling will notify your match right away.</p>
      </StoryModal>
    </div>
  );
}
