import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthToken, decodeJwtPayload, clearAuthToken } from "@/integrations/auth/client";
import { useIdleLogout } from "@/hooks/use-idle-logout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = getAuthToken();
    if (!token) throw redirect({ to: "/auth" });
    const payload = decodeJwtPayload<{ exp?: number }>(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      clearAuthToken();
      throw redirect({ to: "/auth" });
    }
    return { user: payload };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  useIdleLogout();
  return <Outlet />;
}
