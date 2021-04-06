import { Button } from "antd";
import React from "react";
import facebook from "../assets/facebook.svg";
import instagram from "../assets/instagram.svg";
import linkedin from "../assets/linkedin.svg";
import tiktok from "../assets/tiktok.svg";
import twitter from "../assets/twitter.svg";
import StoryInput from "../components/StoryInput";
import "./SocialVerification.css";

const links = [
  {
    id: "twitter",
    linkPrefix: "twitter.com/",
    image: twitter,
  },
  {
    id: "instagram",
    linkPrefix: "instagram.com/",
    image: instagram,
  },
  {
    id: "facebook",
    linkPrefix: "facebook.com/",
    image: facebook,
  },
  {
    id: "tiktok",
    linkPrefix: "tiktok.com/@",
    image: tiktok,
  },
  {
    id: "linkedin",
    linkPrefix: "linkedin.com/in/",
    image: linkedin,
  },
]

interface SocialHandle {
  id?: string;
  handle?: string;
}

interface SocialVerificationProps {
  value?: SocialHandle;
  update: (value: SocialHandle) => void;
}

function SocialVerification(props: SocialVerificationProps) {
  function linkPrefix() {
    const link = links.find(l => l.id === props.value?.id);
    return link?.linkPrefix;
  }

  return (
    <div className="social-verification">
      <div className="social-grid">
        {links.map(l =>
          <Button
            type="text"
            className={props.value?.id === l.id ? "social-button social-button-selected" : "social-button"}
            key={l.id}
            onClick={() => props.update({ ...props.value, id: l.id })}
          >
            <img src={l.image} alt={l.id} />
          </Button>
        )}
      </div>
      {props.value?.id && <div className="social-link">
        <span className="social-link-prefix">{linkPrefix()}</span>
        <StoryInput
          className="social-handle"
          value={props.value?.handle}
          onChange={e => props.update({ ...props.value, handle: e.target.value })}
          autoFocus
        />
      </div>}
    </div>
  );
}

export default SocialVerification;