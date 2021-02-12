import "firebase/storage";
import React from "react";
import "./Bars.css";

function Bars(props: { color: string }) {
  return (
    <div id="bars">
      <div className="bars-inner">
        {[...Array(10)].map((el, i) =>
          <div className="bar" style={{ backgroundColor: props.color }}></div>
        )}
      </div>
    </div>
  );
}

export default Bars;
