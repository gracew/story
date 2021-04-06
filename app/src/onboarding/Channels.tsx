import { Radio } from "antd";
import React from "react";
import StoryInput from "../components/StoryInput";
import StoryRadioGroup from '../components/StoryRadioGroup';
import "./PhotoUpload.css";

const OPTIONS = ["Twitter", "Instagram", "Facebook", "TikTok", "Friend"];

export interface ChannelSelection {
  option?: string;
  context?: string;
}

function followUp(option: string) {
  switch (option) {
    case "Twitter":
    case "Instagram":
    case "Facebook":
    case "TikTok":
      return {
        question: "Do you remember which account specifically?",
        description: <div>This helps us understand what's working well <span role="img" aria-label="emoji-blush">😊</span></div>
      };
    case "Friend":
      return {
        question: "What's your friend's name?",
        description: <div>We want to thank them and make sure you two aren't matched <span role="img" aria-label="emoji-wink">😉</span></div>
      };
    case "Other":
    default:
      return {
        question: "Can you tell us a bit more?",
        description: <div>This helps us understand what's working well <span role="img" aria-label="emoji-blush">😊</span></div>
      };
  }
}

interface ChannelsProps {
  value?: ChannelSelection;
  update: (value?: ChannelSelection) => void;
}

function Channels(props: ChannelsProps) {

  function onOptionSelect(option: string) {
    props.update({ ...props.value, option });
  }

  function onContextChange(context: string) {
    props.update({ ...props.value, context });
  }

  return (
    <div>
      <StoryRadioGroup value={props.value?.option}>
        {OPTIONS.map((o: any) => (
          <Radio
            key={o}
            value={o}
            onClick={() => onOptionSelect(o)}
          >{o}</Radio>))}
        <Radio
          value="Other"
          onClick={() => onOptionSelect("Other")}
        >Other</Radio>
      </StoryRadioGroup>

      {props.value?.option &&
        <div>
          <h3>{followUp(props.value.option).question}</h3>
          {followUp(props.value.option).description}
          <StoryInput autoFocus value={props.value?.context} onChange={e => onContextChange(e.target.value)} />
        </div>
      }
    </div>
  );
}

export default Channels;
