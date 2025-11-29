import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "@/styles/globals.css";

// Register service worker in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Dynamically import the service worker registration for code-splitting
  import("./serviceWorkerRegistration").then(({ register }) => {
    register();
  });
}

// Initialize the app
const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
