import "firebase/analytics";
import firebase from "firebase/app";
import "firebase/remote-config";
import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.less";
import Header from "./Header";
import Login from "./Login";
import Logout from "./Logout";
import Matches from "./matches/Matches";
import Onboarding from "./onboarding/Onboarding";
import OnboardingComplete from "./onboarding/OnboardingComplete";
import Privacy from "./Privacy";
import PrivateRoute from "./PrivateRoute";
import Profile from "./profile/Profile";
import PublicProfile from "./profile/PublicProfile";
import VideoAvailability from "./scheduling/VideoAvailability";
import Terms from "./Terms";
import VideoRedirect from "./VideoRedirect";
// import Matches from "./matches/Matches";

const firebaseConfig = process.env.PUBLIC_URL.startsWith("https://storydating.com")
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
  };

firebase.initializeApp(firebaseConfig);

function App() {
  if (process.env.NODE_ENV === "development" && !process.env.REACT_APP_STAGING_DEV) {
    firebase.functions().useEmulator("localhost", 5001);
    firebase.auth().useEmulator("http://localhost:9099");
    // @ts-ignore -- this is really handy for debugging, since we can access window.firebase from
    // the browser console
    window.firebase = firebase;
  }
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
          <Header />
          <Switch>
            <PrivateRoute path={["/profile/:userId", "/profile"]}>
              <Profile />
            </PrivateRoute>
            <Route path="/u/:userId">
              <PublicProfile />
            </Route>
            <PrivateRoute path={["/m/:matchId", "/matches/:matchId", "/m", "/matches"]}>
              <Matches />
            </PrivateRoute>
            <PrivateRoute path="/s/:matchId">
              <VideoAvailability />
            </PrivateRoute>
            <Route path="/login">
              <Login />
            </Route>
            <Route path="/signup/complete" >
              <OnboardingComplete />
            </Route>
            <PrivateRoute path={["/signup/:step", "/signup", "/join"]} >
              <Onboarding />
            </PrivateRoute>
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
