import React from "react";
import StoryInput from "../components/StoryInput";
import "./SocialVerification.css";

const links = [
  {
    id: "twitter",
    linkPrefix: "twitter.com/",
  },
  {
    id: "instagram",
    linkPrefix: "instagram.com/",
  },
  {
    id: "facebook",
    linkPrefix: "facebook.com/",
  },
  {
    id: "tiktok",
    linkPrefix: "tiktok.com/@",
  },
  {
    id: "linkedin",
    linkPrefix: "linkedin.com/in/",
  },
]
function SocialVerification() {
  return (
    <div>
      {links.map(l =>
        <div className="social-link" key={l.id}>
          <span className="social-link-prefix">{l.linkPrefix}</span>
          <StoryInput className="social-handle" />
        </div>
      )}
    </div>
  );
}

export default SocialVerification;