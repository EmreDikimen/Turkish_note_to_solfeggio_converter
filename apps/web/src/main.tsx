import React from "react";
import ReactDOM from "react-dom/client";
// The two interface faces, self-hosted (COEP forbids a font CDN). Only the subsets a page's text
// needs are downloaded — each @font-face carries a unicode-range; Turkish uses latin + latin-ext.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/eb-garamond/wght.css";
import "@fontsource-variable/eb-garamond/wght-italic.css";
import "./index.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
