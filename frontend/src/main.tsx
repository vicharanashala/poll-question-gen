import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "@/styles/globals.css";
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/router';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import("./serviceWorkerRegistration").then(({ register }) => register());
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);