import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/reminders")({ component: RedirectToSettings });

function RedirectToSettings() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/settings", replace: true });
  }, [navigate]);
  return null;
}
