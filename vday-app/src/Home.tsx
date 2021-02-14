/* eslint-disable jsx-a11y/anchor-is-valid */

import { PauseCircleFilled, PlayCircleFilled, PlusCircleFilled } from "@ant-design/icons";
import { Button, Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/storage";
import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import seedrandom from "seedrandom";
import Bars from "./Bars";
import "./Home.css";

// first 8 from https://html-color.codes/pink
const colors: Record<string, string> = {
  "#ffc0cb": "dark",
  "#ffe4e1": "dark",
  "#ffb6c1": "dark",
  "#ff69b4": "light",
  "#db7093": "light",
  "#ff1493": "light",
  "#fddde6": "dark",
}

function randomColor(i: number) {
  const c = Object.keys(colors);
  const color = c[Math.floor(seedrandom(`${i}`)() * c.length)];
  const textColor = colors[color] === "dark" ? "#333" : "white";
  return { backgroundColor: color, color: textColor };
};

function VDayHome() {
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<Array<any>>([]);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string>();
  const history = useHistory();
  const audioElement = useRef(null);

  useEffect(() => {
    firebase.firestore().collection("vday")
      .orderBy("createdAt", "desc")
      .get()
      .then(res => {
        setLoading(false);
        setClips(res.docs);
      });
  });

  useEffect(() => {
    clips.map(clip =>
      firebase
        .storage()
        .ref(clip.get("recording"))
        .getDownloadURL()
        .then((url) => setClipUrls({ [clip.id]: url })));
  }, [clips]);

  function handleClick(id: string) {
    setSelected(id);
    if (playing) {
      // @ts-ignore
      audioElement.current.pause();
    } else {
      // @ts-ignore
      audioElement.current.play();
    }

    setPlaying(!playing)
  }

  function handleAddYoursClick() {
    firebase.analytics().logEvent("vday_home_add_yours");
    history.push("/record")
  }

  function handleCtaClick() {
    firebase.analytics().logEvent("vday_home_cta");
    window.location.href = "https://storydating.com/join#r=vday";
  }


  if (loading) {
    return <Spin size="large" />
  }

  const text = clips.length === 1 ? "1 person has" : clips.length + " people have";
  return (
    <div className="vday-container">
      <div className="vday-header">
        <p className="vday-prompt-intro">Hear what {text} said in response to...</p>
        <div className="vday-prompt">
          <div className="vday-quote-left">“</div>
          <div className="vday-prompt-text">Tell us about your experience with dating apps.</div>
          <div className="vday-quote-right">”</div>
        </div>
      </div>

      <div className="clip-container">
        {clips.map((clip, i) => {
          const color = randomColor(i);
          const id = "clip-" + i;
          return <div>
            <audio className="clip-audio" src={clipUrls[clip.id]} ref={audioElement} />
            <a className="clip" style={color} onClick={() => handleClick(id)}>
              <div className="clip-inner">
                <div>
                  {(!playing || selected !== id) && <PlayCircleFilled className="clip-play clip-icon" />}
                  {playing && selected === id && <Bars color={color.color} />}
                  {playing && selected === id && <PauseCircleFilled className="clip-pause clip-icon" />}
                  <p className="clip-p" style={color}>{clip.get("firstName")}</p>
                </div>
              </div>
            </a>
          </div>
        })}
        <a className="clip add" onClick={handleAddYoursClick}>
          <div className="clip-inner">
            <div>
              <PlusCircleFilled className="clip-icon" />
              <p className="clip-p">Add Yours</p>
            </div>
          </div>
        </a>
      </div>

      <div className="cta-container">
        <p>Tired of swiping and texting, only to find that when you do talk to someone, their personality doesn't match their profile at all?</p>
        <h2 className="better-way">There's a better way.</h2>
        <p>With Story Dating, we send you a match each week. You have a blind phone date first to
        see if your personalities click, then you can connect again over video. We handle all of the scheduling which
          our users love, and we see who you get along with to find you even better matches.</p>
        <p>We're LIVE and have run 500+ dates. Date better this Valentine's Day.</p>
        <Button size="large" type="primary" onClick={handleCtaClick}>Try a blind phone date</Button>
      </div>
    </div>
  );
}

export default VDayHome;
