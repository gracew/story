import firebase from "firebase";
import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import "./Header.css";

function Logout() {
  const history = useHistory();

  useEffect(() => {
    firebase.auth().signOut().then(() => history.push("/login"));
  })

  return <div></div>;
}

export default Logout;
