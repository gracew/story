import { Button } from "antd";
import "firebase/analytics";
import "firebase/storage";
import React from "react";
import "./Home.css";

function Home() {
  return (
    <div className="home">
      <h2>Want to skip texting back and forth?</h2>
      <p>Record your own voice bio and get matched for audio dates.</p>
      <Button type="primary" href="https://voicebio.typeform.com/to/BzkJGytE">
        Get matched for audio dates
      </Button>
    </div>
  );
}

export default Home;
