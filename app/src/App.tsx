import * as firebase from "firebase/app";
import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.css";
import Listener from "./Listener";
import Recorder from "./Recorder";
import RegisterComplete from "./RegisterComplete";
import PhoneAlreadyExists from './PhoneAlreadyExists';

const firebaseConfig = {
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
  return (
    <Router>
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
        </Switch>
      </div>
    </Router>
  );
}

export default App;
