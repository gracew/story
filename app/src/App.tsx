import "firebase/analytics";
import * as firebase from "firebase/app";
import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.less";
import Listener from "./Listener";
import PhoneAlreadyExists from "./PhoneAlreadyExists";
import Recorder from "./Recorder";
import RegisterComplete from "./RegisterComplete";
import VoiceBio from "./VoiceBio";

const firebaseConfig = process.env.PUBLIC_URL === "https://voicebar.co" ?
{
  apiKey: "AIzaSyATNRFSSQDVmI90c5y7FI817U9lWiH19_w",
  authDomain: "speakeasy-prod.firebaseapp.com",
  databaseURL: "https://speakeasy-prod.firebaseio.com",
  projectId: "speakeasy-prod",
  storageBucket: "speakeasy-prod.appspot.com",
  messagingSenderId: "349979681156",
  appId: "1:349979681156:web:3842ca3cf4b6381e21fdd1",
  measurementId: "G-XG7FSYCC65"
}: {
  apiKey: "AIzaSyBLr4SMn_GwfA6AJFHCqSPrZSfORK3w91I",
  authDomain: "speakeasy-92b16.firebaseapp.com",
  databaseURL: "https://speakeasy-92b16.firebaseio.com",
  projectId: "speakeasy-92b16",
  storageBucket: "speakeasy-92b16.appspot.com",
  messagingSenderId: "232409000476",
  appId: "1:232409000476:web:bb1dafb10521d00aa14dd9",
  measurementId: "G-B4H5ZQQZBD",
};

function App() {
  firebase.initializeApp(firebaseConfig);
  firebase.analytics();
  return (
    <Router>
      <div className="App-header">Voicebar</div>
      <div className="App">
        <Switch>
          <Route path="/record">
            <Recorder />
          </Route>
          <Route path="/register/complete">
            <RegisterComplete />
          </Route>
          <Route path="/register/error">
            <PhoneAlreadyExists />
          </Route>
          <Route path="/listen/:bioId">
            <Listener />
          </Route>
          <Route path="/:username">
            <VoiceBio />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

export default App;
