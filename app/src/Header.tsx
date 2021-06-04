import { HeartFilled, UserOutlined } from "@ant-design/icons";
import { Button, Menu } from "antd";
import firebase from "firebase";
import React, { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import logo from './assets/mainlogo.svg';
import "./Header.css";

enum Page {
  MATCHES = "matches",
  PROFILE = "profile",
}

function Header() {
  const history = useHistory();
  const location = useLocation();
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState(Page.PROFILE);

  useEffect(() => {
    if (["/matches", "/m"].includes(location.pathname)) {
      setCurrentPage(Page.MATCHES);
    }
  }, [location.pathname])

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      setLoggedIn(true);
    }
  });

  function onMenuClick(e: any) {
    const p = e.key as Page;
    setCurrentPage(p);
    switch (p) {
      case Page.MATCHES:
        history.push("/matches");
        break;
      case Page.PROFILE:
      default:
        history.push("/profile");
        break;
    }
  }

  return (
    <div className="story-header">
      <Button type="link" onClick={() => history.push("/profile")}>
        <img src={logo} alt="story-logo" />
      </Button>
      {loggedIn &&
        <Menu onClick={onMenuClick} selectedKeys={[currentPage]} mode="horizontal">
          <Menu.Item
            key={Page.MATCHES}
            className="story-header-menu-item"
            icon={<HeartFilled />}
          />
          <Menu.Item
            key={Page.PROFILE}
            className="story-header-menu-item"
            icon={<UserOutlined />}
          />
        </Menu>
      }
    </div>
  );
}

export default Header;