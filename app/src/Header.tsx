import { HeartFilled, UserOutlined } from "@ant-design/icons";
import { Button } from "antd";
import firebase from "firebase";
import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import logo from './assets/mainlogo.svg';
import "./Header.css";

function Header() {
  const history = useHistory();
  const [loggedIn, setLoggedIn] = useState(false);

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      setLoggedIn(true);
    }
  });

  return (
    <div className="story-header">
      <Button type="link" onClick={() => history.push("/profile")}>
        <img src={logo} alt="story-logo" />
      </Button>
      {loggedIn &&
        <div>
          <Button
            className="menu-button"
            type="text"
            icon={<HeartFilled />}
            size="large"
            onClick={() => history.push("/matches")}
          />
          <Button
            className="menu-button"
            type="text"
            icon={<UserOutlined />}
            size="large"
            onClick={() => history.push("/profile")}
          />
        </div>
      }
    </div >
  );
}

export default Header;
