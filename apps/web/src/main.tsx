import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { initTapDebug } from "./tapDebug";

// ⚠ Temporary, and a no-op without `?tapdebug=1` — see the module.
initTapDebug();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
