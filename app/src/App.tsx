import * as firebase from "firebase/app";
import React from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";
import "./App.css";
import Recorder from "./Recorder";

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
      <Route path="/record">
        <div className="App">
          <Recorder />
        </div>
      </Route>
    </Router>
  );
}

export default App;
