import "firebase/analytics";
import * as firebase from "firebase/app";
import "firebase/remote-config";
import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.less";
import Recorder from "./Recorder";
import VDayHome from "./VDayHome";

/*const firebaseConfig = process.env.PUBLIC_URL.startsWith("https://storydating.com")
  ? {
    apiKey: "AIzaSyATNRFSSQDVmI90c5y7FI817U9lWiH19_w",
    authDomain: "speakeasy-prod.firebaseapp.com",
    databaseURL: "https://speakeasy-prod.firebaseio.com",
    projectId: "speakeasy-prod",
    storageBucket: "speakeasy-prod.appspot.com",
    messagingSenderId: "349979681156",
    appId: "1:349979681156:web:3842ca3cf4b6381e21fdd1",
    measurementId: "G-XG7FSYCC65",
  }
  : {
    apiKey: "AIzaSyBLr4SMn_GwfA6AJFHCqSPrZSfORK3w91I",
    authDomain: "speakeasy-92b16.firebaseapp.com",
    databaseURL: "https://speakeasy-92b16.firebaseio.com",
    projectId: "speakeasy-92b16",
    storageBucket: "speakeasy-92b16.appspot.com",
    messagingSenderId: "232409000476",
    appId: "1:232409000476:web:bb1dafb10521d00aa14dd9",
    measurementId: "G-B4H5ZQQZBD",
  };*/
const firebaseConfig =
{
  apiKey: "AIzaSyATNRFSSQDVmI90c5y7FI817U9lWiH19_w",
  authDomain: "speakeasy-prod.firebaseapp.com",
  databaseURL: "https://speakeasy-prod.firebaseio.com",
  projectId: "speakeasy-prod",
  storageBucket: "speakeasy-prod.appspot.com",
  messagingSenderId: "349979681156",
  appId: "1:349979681156:web:3842ca3cf4b6381e21fdd1",
  measurementId: "G-XG7FSYCC65",
};

firebase.initializeApp(firebaseConfig);

function App() {
  firebase.remoteConfig().fetchAndActivate();
  firebase.analytics();

  return (
    <Router>
      <header>
        Brought to you by <a href="/">Story Dating</a>
      </header>
      <Switch>
        <div className="App">
          <Route path="/record">
            <Recorder />
          </Route>
          <Route>
            <VDayHome />
          </Route>
        </div>

      </Switch>
    </Router>
  );
}

export default App;
