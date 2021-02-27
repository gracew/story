import "firebase/analytics";
import firebase from "firebase/app";
import "firebase/remote-config";
import "firebase/storage";
import * as firebaseui from "firebaseui";
import 'firebaseui/dist/firebaseui.css';
import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import "./Login.css";

function Login() {
  const history = useHistory();

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      history.push("/profile")
    }
  });

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
      callbacks: {
        signInSuccessWithAuthResult: (authResult: firebase.auth.UserCredential) => {
          if (authResult.user && authResult.user.phoneNumber) {
            history.push("/profile")
          }
          return false;
        }
      },
    });
  })

  return (
    <div className="story-login-container">
      <div id="firebaseui-auth-container"></div>
    </div>
  );
}

export default Login;
