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

  const redirectProps = {
    pathname: "/login",
    state: { redirect: location.pathname },
  }
  return <Route path={props.path} render={props2 => userLoading
    ? <CenteredSpin />
    : firebase.auth().currentUser
      ? props.children
      : <Redirect to={redirectProps} />} />;
}

export default PrivateRoute;
