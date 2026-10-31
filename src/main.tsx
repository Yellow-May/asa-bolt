import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { restoreOwnerRoute } from "./owner-session";
import "./styles.css";
import "./booking.css";
import "./controls.css";
import "./admin.css";

restoreOwnerRoute();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
