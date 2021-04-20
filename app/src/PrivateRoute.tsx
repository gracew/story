import firebase from "firebase";
import React, { FunctionComponent, useState } from "react";
import { Redirect, Route, RouteProps, useLocation } from "react-router-dom";
import CenteredSpin from "./components/CenteredSpin";
import "./Header.css";

const PrivateRoute: FunctionComponent<RouteProps> = (props) => {
  const location = useLocation();
  const [userLoading, setUserLoading] = useState(true);

  firebase.auth().onAuthStateChanged(function (user) {
    setUserLoading(false);
  });


  function childNode() {
    if (userLoading) {
      return <CenteredSpin />;
    }
    if (firebase.auth().currentUser) {
      return props.children;
    }
    console.log(location.pathname);
    if (location.pathname === "/signup" || location.pathname === "/join") {
      firebase.analytics().logEvent(`signup_view`);
    }

    const redirectProps = {
      pathname: "/login",
      search: window.location.search,
      state: { redirect: location.pathname },
    }
    return <Redirect to={redirectProps} />;
  }

  return <Route path={props.path} render={props2 => childNode()} />;
}

export default PrivateRoute;
