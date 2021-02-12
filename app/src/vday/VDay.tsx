import "firebase/storage";
import React from "react";
import { Route, Switch } from "react-router-dom";
import Recorder from "./Recorder";
import "./VDay.css";
import VDayHome from "./VDayHome";

function VDay() {
  return (
    <div className="vday-container">
      <div className="vday-header">
        Brought to you by <a href="/">Story Dating</a>
      </div>
      <Switch>
        <Route path="/vday/record">
          <Recorder />
        </Route>
        <Route>
          <VDayHome />
        </Route>
      </Switch>
    </div>
  );
}

export default VDay;
