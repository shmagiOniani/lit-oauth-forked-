import "./App.css";
import { Button } from "@consta/uikit/Button";
import { Theme, presetGpnDefault } from "@consta/uikit/Theme";
import axios from "axios";
import LitJsSdk from "lit-js-sdk";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

function App() {
  const connect = async (service) => {
    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });

    if (service === "zoom") {
      const resp = await axios.post(`${API_HOST}/api/oauth/zoom/login`, {
        authSig,
      });
      if (resp.data.redirectTo) {
        window.location = resp.data.redirectTo;
      }
    }
  };

  return (
    <Theme preset={presetGpnDefault}>
      <div className="App">
        <Button
          label="Connect your Zoom account"
          onClick={() => connect("zoom")}
        />
      </div>
    </Theme>
  );
}

export default App;
