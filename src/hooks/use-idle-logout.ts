import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { clearAuthToken } from "@/integrations/auth/client";
import { toast } from "sonner";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

export function useIdleLogout() {
  const navigate = useNavigate();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const logout = () => {
      clearAuthToken();
      toast.message("Signed out due to inactivity");
      navigate({ to: "/auth" });
    };
    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(logout, TIMEOUT_MS);
    };
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [navigate]);
}
