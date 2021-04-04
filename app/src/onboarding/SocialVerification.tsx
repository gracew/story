import { Button } from "antd";
import React, { useState } from "react";
import facebook from "../assets/facebook.svg";
import instagram from "../assets/instagram.svg";
import linkedin from "../assets/linkedin.svg";
import tiktok from "../assets/tiktok.svg";
import twitter from "../assets/twitter.svg";
import StoryInput from "../components/StoryInput";
import "./SocialVerification.css";

interface Link {
  id: string;
  linkPrefix: string;
}

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

interface SocialVerificationProps {
  update: (link: string) => void;
}

function SocialVerification(props: SocialVerificationProps) {
  const [selected, setSelected] = useState<Link>();
  function onChange(handle: string) {
    props.update(selected!.linkPrefix + handle);
  }

  return (
    <div className="social-verification">
      <div className="social-grid">
        {links.map(l =>
          <Button
            type="text"
            className={selected?.id === l.id ? "social-button social-button-selected" : "social-button"}
            key={l.id}
            onClick={() => setSelected(l)}
          >
            <img src={l.image} alt={l.id} />
          </Button>
        )}
      </div>
      {selected && <div className="social-link">
        <span className="social-link-prefix">{selected!.linkPrefix}</span>
        <StoryInput className="social-handle" onChange={e => onChange(e.target.value)} />
      </div>}
    </div>
  );
}

export default SocialVerification;