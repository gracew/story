/* eslint-disable jsx-a11y/anchor-is-valid */

import { PauseCircleFilled, PlayCircleFilled, PlusCircleFilled } from "@ant-design/icons";
import { Button } from "antd";
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
  "#ffb6c1": "light",
  "#ff69b4": "light",
  "#db7093": "light",
  "#ff1493": "light",
  "#fddde6": "dark",
}

const names = [
  "George",
  "Emma",
  "Elissa",
  "Kathryn",
  "Mike",
  "Yitian",
  "Abhi",
  "Zack",
  "Charlotte",
  "Jason",
  "Christine",
  "Div",
  "Grace"
]

function randomColor(i: number) {
  const c = Object.keys(colors);
  const color = c[Math.floor(seedrandom(`${i}`)() * c.length)];
  const textColor = colors[color] === "dark" ? "#333" : "white";
  return { backgroundColor: color, color: textColor };
};

function randomName(i: number) {
  return names[Math.floor(seedrandom(`${i}`)() * names.length)];
};

function VDayHome() {
  const [bioUrl, setBioUrl] = useState();
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string>();
  const history = useHistory();
  const audioElement = useRef(null);

  useEffect(() => {
    firebase
      .storage()
      .ref(`bios/89f6ddce-2dae-474e-b7a8-29fafa73e1f8`)
      .getDownloadURL()
      .then((url) => setBioUrl(url));
  });

  const n = 28;

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
    history.push("/vday/record")
  }

  return (
    <div className="vday-container">
      <div className="vday-prompt">
        <p>Hear what {n} people have said in response to...</p>
        <blockquote>Tell us about your experience with dating apps.</blockquote>
      </div>

      <audio className="clip-audio" src={bioUrl} ref={audioElement} />
      <div className="clip-container">
        {[...Array(n)].map((el, i) => {
          const color = randomColor(i);
          const id = "clip-" + i;
          return <div>
            <a className="clip" style={color} onClick={() => handleClick(id)}>
              <div className="clip-inner">
                <div>
                  {(!playing || selected !== id) && <PlayCircleFilled className="clip-play clip-icon" />}
                  {playing && selected === id && <Bars color={color.color} />}
                  {playing && selected === id && <PauseCircleFilled className="clip-pause clip-icon" />}
                  <p className="clip-p" style={color}>{randomName(i)}</p>
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
        <Button size="large" type="primary">Try a blind phone date</Button>
      </div>
    </div>
  );
}

export default VDayHome;
