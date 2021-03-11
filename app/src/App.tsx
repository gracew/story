import "firebase/analytics";
import firebase from "firebase/app";
import "firebase/remote-config";
import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.less";
import Header from "./Header";
import Login from "./Login";
import Logout from "./Logout";
import Privacy from "./Privacy";
import Profile from "./Profile";
import PublicProfile from "./PublicProfile";
import Terms from "./Terms";
import VideoRedirect from "./VideoRedirect";

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
      <Switch>
        <Route path="/privacy">
          <Privacy />
        </Route>
        <Route path="/terms">
          <Terms />
        </Route>
        <Route path="/v/:videoId/:user">
          <VideoRedirect />
        </Route>
        <div className="App">
          <Switch>
            <Route path="/profile" exact>
              <Header showLogout={true} />
              <Profile />
            </Route>
            <Route path="/profile/:userId">
              <Header showLogout={true} />
              <Profile />
            </Route>
            <Route path="/u/:userId">
              <Header />
              <PublicProfile />
            </Route>
            <Route path="/login">
              <Header />
              <Login />
            </Route>
            <Route path="/logout">
              <Logout />
            </Route>
          </Switch>
        </div>
      </Switch>
    </Router>
  );
}

export default App;
