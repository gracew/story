import { Input } from "antd";
import firebase from "firebase/app";
import React, { useEffect, useState } from "react";
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useHistory } from "react-router-dom";
import CenteredDiv from "./components/CenteredDiv";
import StoryButton from "./components/StoryButton";
import StoryButtonContainer from "./components/StoryButtonContainer";
import "./Login.css";

function Login() {
  const history = useHistory();

  // save user input
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  // used internally
  const [step, setStep] = useState("")
  const [confirmationResult, setConfirmationResult] = useState<firebase.auth.ConfirmationResult>();
  const [validCode, setValidCode] = useState(true);
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<firebase.auth.RecaptchaVerifier>();

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      history.push("/profile")
    }
  });

  useEffect(() => {
    setRecaptchaVerifier(new firebase.auth.RecaptchaVerifier('request-code', {
      size: 'invisible',
    }));
  }, []);

  async function onRequestCode() {
    setRequestingCode(true);
    try {
      const confirmationResult = await firebase.auth().signInWithPhoneNumber(phone, recaptchaVerifier!);
      // SMS sent. Prompt user to type the code from the message, then sign the
      // user in with confirmationResult.confirm(code).
      setConfirmationResult(confirmationResult);
      setStep("verification-code");
    } catch (error) {
      // Error; SMS not sent
      console.error(error)
    } finally {
      setRequestingCode(false);
    }
  }

  function onCancel() {
    setCode("");
    setValidCode(true);
    setStep("");
  }

  async function onVerify() {
    setVerifyingCode(true);
    try {
      await confirmationResult?.confirm(code);
      history.push("/profile");
    } catch (e) {
      setValidCode(false);
    } finally {
      setVerifyingCode(false);
    }
  }

  if (step === "verification-code") {
    return (
      <div className="login">
        <CenteredDiv>
          <div className="login-input">
            <div className="login-input-title">Verify your phone number</div>
            <div className="login-input-desc">Enter the 6-digit code we sent to <span className="phone-number">{phone}</span></div>
            <Input
              className="code-input"
              placeholder="6-digit code"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            {!validCode && <div className="code-error">Wrong code. Try again.</div>}
          </div>
        </CenteredDiv>
        <StoryButtonContainer>
          <StoryButton
            className="login-cancel"
            onClick={onCancel}
          >Cancel</StoryButton>
          <StoryButton
            className="verify-code"
            type="primary"
            onClick={onVerify}
            disabled={code.length !== 6}
            loading={verifyingCode}
          >Verify</StoryButton>
        </StoryButtonContainer>
      </div>
    );
  }

  return (
    <div className="login">
      <CenteredDiv>
        <div className="login-input">
          <div className="login-input-title">Enter your phone number</div>
          <PhoneInput
            placeholder="Enter phone number"
            defaultCountry="US"
            value={phone}
            onChange={setPhone}
          />
        </div>
      </CenteredDiv>
      <StoryButtonContainer>
        <StoryButton
          id="request-code"
          type="primary"
          onClick={onRequestCode}
          disabled={!isPossiblePhoneNumber(phone || "")}
          loading={requestingCode}
        >
          Request Verification Code
        </StoryButton>
      </StoryButtonContainer>
    </div>
  );
}

export default Login;
