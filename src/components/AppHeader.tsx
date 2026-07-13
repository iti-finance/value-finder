import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, ShieldCheck, LogOut, Calculator } from "lucide-react";
import itiLogo from "@/assets/iti-logo.png";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useCurrentUser } from "@/hooks/use-current-user";
import { clearAuthToken } from "@/integrations/auth/client";

export function AppHeader({ rightSlot }: { rightSlot?: ReactNode }) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const signOut = async () => {
    clearAuthToken();
    navigate({ to: "/auth" });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-white dark:bg-card border shadow-md p-1">
            <img
              src={itiLogo}
              alt="ITI Finance"
              className="h-full w-full object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">ITI Finance Limited</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Used Tractor Financing Grid
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          {rightSlot}
          {user?.role === "admin" && (
            <>
              <Button variant="ghost" size="icon" asChild aria-label="Vehicle finder">
                <Link to="/value-finder">
                  <Calculator className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild aria-label="Admin">
                <Link to="/admin">
                  <ShieldCheck className="h-5 w-5" />
                </Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="Sign out"
              title={`Sign out ${user.employeeCode}`}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
