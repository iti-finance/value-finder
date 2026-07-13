import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAuthToken, setAuthToken, decodeJwtPayload } from "@/integrations/auth/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import itiLogo from "@/assets/iti-logo.png";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  adminBootstrapStatus,
  bootstrapFirstAdmin,
  login,
  requestPasswordReset,
} from "@/lib/auth.functions";
import { logAuditEvent } from "@/lib/vehicle.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — ITI Finance Limited" },
      {
        name: "description",
        content: "Secure access to the ITI Finance Used Tractor Financing Grid.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"branch" | "admin">("branch");
  const [employeeCode, setEmployeeCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  const loginFn = useServerFn(login);
  const bootstrapStatusFn = useServerFn(adminBootstrapStatus);
  const bootstrapFn = useServerFn(bootstrapFirstAdmin);
  const auditFn = useServerFn(logAuditEvent);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      const payload = decodeJwtPayload<{ exp?: number }>(token);
      if (payload && (!payload.exp || payload.exp * 1000 > Date.now())) {
        navigate({ to: "/" });
        return;
      }
    }

    (async () => {
      const status = await bootstrapStatusFn();
      setNeedsBootstrap(status.needsBootstrap);
    })();
  }, [bootstrapStatusFn, navigate]);

  const signIn = async () => {
    const identifier = mode === "admin" ? adminEmail.trim().toLowerCase() : employeeCode.trim();
    if (!identifier || !password) return;
    setLoading(true);
    try {
      const result = await loginFn({
        data: { identifier, password, mode },
      });
      setAuthToken(result.token);
      await auditFn({
        data: {
          action: "login",
          details: { at: new Date().toISOString(), mode },
        },
      });
      navigate({ to: "/" });
    } catch (error) {
      toast.error(
        mode === "admin" ? "Invalid Email or Password" : "Invalid Employee Code or Password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-2xl bg-white dark:bg-card border shadow-lg p-2">
            <img
              src={itiLogo}
              alt="ITI Finance"
              className="h-full w-full object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">ITI Finance Limited</h1>
          <p className="mt-1 text-sm text-muted-foreground">Used Tractor Financing Grid</p>
        </div>

        <Card className="w-full border-0 shadow-[var(--shadow-card)]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure Sign In
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "branch" | "admin")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="branch">Branch User</TabsTrigger>
                <TabsTrigger value="admin">Administrator</TabsTrigger>
              </TabsList>
              <TabsContent value="branch" className="mt-3 space-y-1.5">
                <Label htmlFor="employee_code">Employee Code</Label>
                <Input
                  id="employee_code"
                  autoComplete="username"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                />
              </TabsContent>
              <TabsContent value="admin" className="mt-3 space-y-1.5">
                <Label htmlFor="admin_email">Email</Label>
                <Input
                  id="admin_email"
                  type="email"
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                />
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              className="h-11 w-full text-base"
              onClick={signIn}
              disabled={loading || !password || (mode === "admin" ? !adminEmail : !employeeCode)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>

            <div className="flex items-center justify-between text-xs">
              <ForgotPassword />
              <span className="text-muted-foreground">v1.0</span>
            </div>

            {needsBootstrap && (
              <BootstrapAdmin bootstrapFn={bootstrapFn} onDone={() => setNeedsBootstrap(false)} />
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} ITI Finance Limited. Authorized personnel only.
        </p>
      </div>
    </div>
  );
}

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const resetFn = useServerFn(requestPasswordReset);

  const submit = async () => {
    if (!code.trim()) return;
    setSending(true);
    try {
      await resetFn({ data: { employee_code: code.trim() } });
      toast.success("Reset request sent. An administrator will reset your password.");
      setOpen(false);
      setCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="font-medium text-primary hover:underline">
          Forgot Password?
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Password Reset</DialogTitle>
          <DialogDescription>
            Enter your Employee Code. An administrator will reset your password and inform you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reset-code">Employee Code</Label>
          <Input id="reset-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={sending || !code.trim()}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BootstrapAdmin({
  bootstrapFn,
  onDone,
}: {
  bootstrapFn: (args: {
    data: { employee_code: string; full_name: string; email: string; password: string };
  }) => Promise<unknown>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await bootstrapFn({
        data: {
          employee_code: employeeCode.trim(),
          full_name: fullName.trim(),
          password,
          email: email.trim(),
        },
      });
      toast.success("Admin created. You can now sign in.");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs">
      <p className="mb-2 font-medium">First-time setup required</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            Create First Administrator
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up first administrator</DialogTitle>
            <DialogDescription>
              This is a one-time setup. Subsequent users must be created by an admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Employee Code</Label>
              <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="admin@itifl.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password (min 6 chars)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={submit}
              disabled={loading || !employeeCode || !fullName || !email || password.length < 6}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
