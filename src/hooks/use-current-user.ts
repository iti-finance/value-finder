import { useEffect, useState } from "react";
import { decodeJwtPayload, getAuthToken, clearAuthToken } from "@/integrations/auth/client";

export type CurrentUser = {
  userId: string;
  employeeCode: string;
  fullName: string;
  role: "admin" | "branch";
} | null;

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = getAuthToken();
      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const payload = decodeJwtPayload<{
        userId: string;
        employeeCode: string;
        fullName: string;
        role: "admin" | "branch";
        exp?: number;
      }>(token);

      if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
        clearAuthToken();
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (!active) return;
      setUser({
        userId: payload.userId,
        employeeCode: payload.employeeCode,
        fullName: payload.fullName,
        role: payload.role,
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { user, loading };
}
