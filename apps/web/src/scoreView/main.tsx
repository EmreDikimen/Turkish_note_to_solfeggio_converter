/**
 * Entry of the native app's score view — `score-view.html`, built into one file by
 * `tools/build-score-view.mjs`. Same fonts and the same stylesheet as the web app (`main.tsx`), so
 * the phone's staff is the web's staff.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/eb-garamond/wght.css";
import "@fontsource-variable/eb-garamond/wght-italic.css";
import "../index.css";
import { ScoreView } from "./ScoreView";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ScoreView />
  </React.StrictMode>,
);
