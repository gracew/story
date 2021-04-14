import { Checkbox, Radio } from "antd";
import firebase from "firebase";
import moment from "moment-timezone";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CenteredSpin from "../components/CenteredSpin";
import StoryButton from "../components/StoryButton";
import StoryButtonContainer from "../components/StoryButtonContainer";
import StoryCheckboxGroup from "../components/StoryCheckboxGroup";
import StoryRadioGroup from "../components/StoryRadioGroup";
import "./VideoAvailability.css";
import VideoAvailabilitySubmitted from "./VideoAvailabilitySubmitted";

export enum Timezone {
  PT = "PT",
  MT = "MT",
  CT = "CT",
  ET = "ET",
}

export function formatTime(t: string, tz: string) {
  return moment(t).tz(tz).format("dddd ha");
}

function formatTimezone(tz: Timezone) {
  switch (tz) {
    case Timezone.PT:
      return "Pacific Time";
    case Timezone.MT:
      return "Mountain Time";
    case Timezone.CT:
      return "Central Time";
    case Timezone.ET:
      return "Eastern Time";
    default:
      return "Pacific Time";
  }
}

enum SubmitState {
  SUBMITTING,
  SUBMITTED,
}

function VideoAvailability() {
  // @ts-ignore
  const { matchId } = useParams();
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [swapNumbers, setSwapNumbers] = useState<boolean>();
  const [submitState, setSubmitState] = useState<SubmitState>();
  const [data, setData] = useState<Record<string, any>>();

  function onTimeSelect(time: string) {
    if (selectedTimes.includes(time)) {
      const i = selectedTimes.indexOf(time);
      setSelectedTimes(selectedTimes.slice(0, i).concat(selectedTimes.slice(i + 1)));
    } else {
      setSelectedTimes([...selectedTimes, time]);
    }
  }

  async function onSubmit() {
    setSubmitState(SubmitState.SUBMITTING);
    await firebase.functions().httpsCallable("saveVideoAvailability")( { matchId, selectedTimes, swapNumbers })
    setSubmitState(SubmitState.SUBMITTED);
  }

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getVideoAvailability")({ matchId })
      .then((res) => {
        setData(res.data);
        setSelectedTimes(res.data.selectedTimes || []);
        setSwapNumbers(res.data.swapNumbers);
      })
  }, [matchId]);

  if (submitState === SubmitState.SUBMITTED) {
    return <VideoAvailabilitySubmitted />
  }

  if (!data) {
    return <CenteredSpin />
  }

  return (
    <div className="video-availability-container">
      <div className="video-availability-input">
        <h3>What times are you free to video chat with {data.matchName}?</h3>
        <div className="video-availability-description">All times are {formatTimezone(data.tz)}</div>
        <StoryCheckboxGroup value={selectedTimes}  >
          {data.timeOptions.map((o: string) => (
            <Checkbox
              key={o}
              value={o}
              onClick={() => onTimeSelect(o)}
            >{formatTime(o, data.tz)}</Checkbox>))}
        </StoryCheckboxGroup>

        <h3>What would you like to do if none of these times work for you and {data.matchName}?</h3>
        <StoryRadioGroup value={swapNumbers}>
          <Radio value={true} onClick={() => setSwapNumbers(true)}>Swap numbers</Radio>
          <Radio value={false} onClick={() => setSwapNumbers(false)}>Start a text chat (my number will be hidden)</Radio>
        </StoryRadioGroup>
      </div>

      <StoryButtonContainer>
        <StoryButton
          className="video-availability-submit"
          type="primary"
          onClick={onSubmit}
          disabled={swapNumbers === undefined}
          loading={submitState === SubmitState.SUBMITTING}
        >
          Submit
        </StoryButton>
      </StoryButtonContainer>
    </div>

  );
}

export default VideoAvailability;

