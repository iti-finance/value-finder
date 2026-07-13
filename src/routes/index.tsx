import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import itiLogo from "@/assets/iti-logo.png";
import { getAuthToken, decodeJwtPayload } from "@/integrations/auth/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ITI Finance Limited — Used Tractor Financing Grid" },
      { name: "description", content: "Secure financing grid lookup for ITI Finance branches." },
    ],
  }),
  component: RootRedirect,
});

function RootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const payload = decodeJwtPayload<{ role?: string }>(token);
      if (!payload) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const isAdmin = payload.role === "admin";
      navigate({ to: isAdmin ? "/admin" : "/value-finder", replace: true });
    })();
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-white dark:bg-card border shadow-lg p-1.5">
          <img
            src={itiLogo}
            alt="ITI Finance"
            className="h-full w-full object-contain"
            loading="eager"
            decoding="async"
          />
        </div>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}
