import { Button } from "antd";
import firebase from "firebase";
import "firebase/analytics";
import "firebase/remote-config";
import "firebase/storage";
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
      <a href="/">
        <img src={logo} alt="story-logo" />
      </a>
      {props.showLogout &&
        <Button className="logout-button" type="link" onClick={logout}><img src={logoutIcon} alt="logout" /></Button>
      }
    </div>
  );
}

export default Header;
