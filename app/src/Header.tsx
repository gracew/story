import { Button } from "antd";
import firebase from "firebase";
import React from "react";
import { useHistory } from "react-router-dom";
import logoutIcon from './assets/logout.svg';
import logo from './assets/mainlogo.svg';
import "./Header.css";

export interface HeaderProps {
  showLogout?: boolean;
}

function Header(props: HeaderProps) {
  const history = useHistory();

  async function logout() {
    await firebase.auth().signOut();
    history.push("/login")
  }

  return (
    <div className="story-header">
      <Button type="link" onClick={() => history.push("/profile")}>
        <img src={logo} alt="story-logo" />
      </Button>
      {props.showLogout &&
        <Button className="logout-button" type="link" onClick={logout}><img src={logoutIcon} alt="logout" /></Button>
      }
    </div>
  );
}

export default Header;
