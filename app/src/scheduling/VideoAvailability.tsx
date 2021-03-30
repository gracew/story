import { Checkbox, Radio } from "antd";
import firebase from "firebase";
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
  CT = "CT",
  ET = "ET",
}

export enum Day {
  Sunday = "Sunday",
  Monday = "Monday",
  Tuesday = "Tuesday",
  Wednesday = "Wednesday",
  Thursday = "Thursday",
  Friday = "Friday",
  Saturday = "Saturday",
}

function timeOptions(tz: Timezone, matchTz: Timezone) {
  switch (true) {
    // PT
    case (tz === Timezone.PT && matchTz === Timezone.PT):
      return ["6pm", "7pm", "8pm"];
    case (tz === Timezone.PT && matchTz === Timezone.CT):
      return ["6pm"];
    case (tz === Timezone.PT && matchTz === Timezone.ET):
      return ["6pm"];
    // CT
    case (tz === Timezone.CT && matchTz === Timezone.PT):
      return ["8pm"];
    case (tz === Timezone.CT && matchTz === Timezone.CT):
      return ["6pm", "7pm", "8pm"];
    case (tz === Timezone.CT && matchTz === Timezone.ET):
      return ["6pm", "7pm", "8pm"];
    // ET
    case (tz === Timezone.ET && matchTz === Timezone.PT):
      return ["9pm"];
    case (tz === Timezone.ET && matchTz === Timezone.CT):
      return ["7pm", "8pm", "9pm"];
    case (tz === Timezone.ET && matchTz === Timezone.ET):
      return ["7pm", "8pm", "9pm"];
    default:
      return [];
  }
}

function dayOptions() {
  const day = new Date().getDay();  // 0: Sunday, 1: Monday, etc
  switch (day) {
    case 2: // Tuesday
      return [Day.Wednesday, Day.Thursday, Day.Friday];
    case 3: // Wednesday
      return [Day.Thursday, Day.Friday, Day.Saturday];
    case 4: // Thursday
      return [Day.Friday, Day.Saturday, Day.Sunday];
    case 5: // Friday
      return [Day.Saturday, Day.Sunday, Day.Monday];
    default:
      return [];
  }
}

function formatTimezone(tz: Timezone) {
  switch (tz) {
    case Timezone.PT:
      return "Pacific Time";
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
    await firebase.functions().httpsCallable("saveVideoAvailability")( { matchId, selectedTimes })
    setSubmitState(SubmitState.SUBMITTED);
  }

  useEffect(() => {
    firebase
      .functions()
      .httpsCallable("getVideoAvailabilityParameters")({ matchId })
      .then((res) => setData(res.data))
  }, [matchId]);

  if (submitState === SubmitState.SUBMITTED) {
    return <VideoAvailabilitySubmitted />
  }

  if (!data) {
    return <CenteredSpin />
  }

  const days = dayOptions();
  const times = timeOptions(data.tz, data.matchTz);
  const options: string[] = []
  days.map(d => times.map(t => options.push(`${d} ${t}`)));

  return (
    <div className="video-availability-container">
      <div className="video-availability-input">
        <h3>What times are you free to video chat with {data.matchName}?</h3>
        <div className="video-availability-description">All times are {formatTimezone(data.tz)}</div>
        <StoryCheckboxGroup value={selectedTimes}  >
          {options.map(o => (
            <Checkbox
              key={o}
              value={o}
              onClick={() => onTimeSelect(o)}
            >{o}</Checkbox>))}
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

