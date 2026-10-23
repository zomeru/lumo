import { createAppRouter } from "@lumolynk/app";
import { initializeTheme } from "@lumolynk/ui/theme";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@lumolynk/ui/styles.css";

initializeTheme();
const router = createAppRouter();

const root = document.getElementById("root");
if (!root) throw new Error("The application root element is missing.");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
