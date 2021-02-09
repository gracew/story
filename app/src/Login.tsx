import "firebase/analytics";
import * as firebase from "firebase/app";
import * as firebaseui from "firebaseui";
import { useHistory } from "react-router-dom";
import "firebase/remote-config";
import "firebase/storage";
import React, { useEffect } from "react";
import "./Login.css";
import 'firebaseui/dist/firebaseui.css'

function Login() {
  const history = useHistory();
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
    <div id="firebaseui-auth-container"></div>
  );
}

export default Login;
