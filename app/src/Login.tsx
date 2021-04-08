import firebase from "firebase/app";
import React, { useEffect, useState } from "react";
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useHistory, useLocation } from "react-router-dom";
import CenteredDiv from "./components/CenteredDiv";
import StoryButton from "./components/StoryButton";
import StoryButtonContainer from "./components/StoryButtonContainer";
import StoryFilledInput from "./components/StoryFilledInput";
import "./Login.css";

function Login() {
  const history = useHistory();
  const location = useLocation();
  const redirect = (location.state as any)?.redirect || "/profile";

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
      history.push(redirect);
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
      history.push(redirect);
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
            <StoryFilledInput
              placeholder="6-digit code"
              maxLength={6}
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

  const titleText = redirect === "/signup" ? "What's your phone number?" : "Enter your phone number";
  return (
    <div className="login">
      <CenteredDiv>
        <div className="login-input">
          <div className="login-input-title">{titleText}</div>
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
          Next
        </StoryButton>
      </StoryButtonContainer>
      {redirect === "/signup" && <div className="legal-text">
        Joining means you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>, and to
        get several messages per week. Data rates may apply. Text STOP to cancel, HELP for help.
      </div>}
    </div>
  );
}

export default Login;
