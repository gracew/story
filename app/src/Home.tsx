import { Button } from "antd";
import "firebase/analytics";
import "firebase/storage";
import React from "react";
import "./Home.css";

function Home() {
  return (
    <div className="home">
      <h2>Want to skip texting back and forth?</h2>
      <p>Record your own voice bio and get matched for voice dates.</p>
      <Button type="primary" href="https://voicebar.typeform.com/to/NUynD2GT">
        Get matched for voice dates
      </Button>
    </div>
  );
}

export default Home;
