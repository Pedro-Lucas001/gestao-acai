import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const isProd = (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;
if ("serviceWorker" in navigator && isProd) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
