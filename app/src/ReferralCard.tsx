import { CopyOutlined } from "@ant-design/icons";
import { Button } from "antd";
import "firebase/remote-config";
import React from "react";
import balloons from './assets/balloons.svg';
import socials1 from './assets/socials-1.svg';
import socials2 from './assets/socials-2.svg';
import socials3 from './assets/socials-3.svg';
import socials from './assets/socials.svg';
import "./ReferralCard.css";

interface ReferralCardProps {
  referrerId: string;
}

function ReferralCard(props: ReferralCardProps) {
  const link = "https://story.dating/r?r=" + props.referrerId;

  return (
    <div className="referral-card">
      <div className="referral-card-top">
        <h2>Share Story with others and help make dating genuine again.</h2>
        <img src={balloons} alt="balloons" />
      </div>
      <Button type="text" className="referral-link">
        <span>{link}</span>
        <CopyOutlined />
      </Button>
      <div className="referral-text">
        Copy the link above to share or share via any of the platforms below.
      </div>
      <div className="social-buttons">
        <a href={"fb-messenger://share?link=" + link}>
          <img src={socials} alt="messenger" />
        </a>
        <a href={"whatsapp://send?text=Hey, I have an invite to Story Dating and want you to join. It's a voice-first dating experience that focuses on talking, not texting. Here's the link! " + link}>
          <img src={socials1} alt="whatsapp" />
        </a>
        <a href={"twitter://post?message=I found out about Story Dating recently - it's a voice-first dating experience that focuses on talking, not texting. Use my invite link if you're looking for a different way to date! " + link}>
          <img src={socials2} alt="twitter" />
        </a>
        <a href={"sms:&body=Hey, I have an invite to Story Dating and want you to join. It's a voice-first dating experience that focuses on talking, not texting. Here's the link! " + link}>
          <img src={socials3} alt="sms" />
        </a>
      </div>
    </div>
  );
}

export default ReferralCard;
