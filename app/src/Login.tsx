import { Button, Input, Spin } from "antd";
import "firebase/analytics";
import * as firebase from "firebase/app";
import * as firebaseui from "firebaseui";
import parsePhoneNumber, { AsYouType } from "libphonenumber-js";
import { useHistory, useLocation } from "react-router-dom";
import "firebase/remote-config";
import "firebase/storage";
import React, { isValidElement, useEffect, useState } from "react";
import "./Login.css";
import 'firebaseui/dist/firebaseui.css'

function Login() {
  useEffect(() => {
    const ui = new firebaseui.auth.AuthUI(firebase.auth());
    ui.start('#firebaseui-auth-container', {
      signInOptions: [
        {
          provider: firebase.auth.PhoneAuthProvider.PROVIDER_ID,
          recaptchaParameters: {
            size: 'invisible', 
          },
        }
      ],
      signInSuccessUrl: "/profile"
    });
  })

  return (
    <div id="firebaseui-auth-container"></div>
  );
}

export default Login;
