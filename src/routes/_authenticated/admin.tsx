import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/AppHeader";
import { getAuthToken, decodeJwtPayload } from "@/integrations/auth/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  checkIsAdmin,
  replaceVehicleData,
  clearAuditLogs,
  deleteAuditLog,
  changeOwnPassword,
} from "@/lib/admin.functions";
import {
  logAuditEvent,
  getUploadHistory,
  getPasswordResetRequests,
  getAuditLogs,
} from "@/lib/vehicle.functions";
import {
  createUser,
  deleteUser,
  listAllUsers,
  resetUserPassword,
  resolvePasswordResetRequest,
  setUserActive,
} from "@/lib/users.functions";
import { bulkCreateUsers } from "@/lib/users.functions";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  LogOut,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  Users as UsersIcon,
  History,
  KeyRound,
  Trash2,
  ShieldCheck,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Console — ITI Finance" }] }),
  component: AdminPage,
});

type Row = { make: string; model: string; variant: string; year: number; value: number };

function AdminPage() {
  const navigate = useNavigate();
  const isAdminFn = useServerFn(checkIsAdmin);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await isAdminFn();
        setIsAdmin(r.isAdmin);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [isAdminFn]);

  const signOut = async () => {
    // clear token and redirect
    const { clearAuthToken } = await import("@/integrations/auth/client");
    clearAuthToken();
    navigate({ to: "/auth" });
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="grid place-items-center pt-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 pt-10">
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Your account does not have admin access.</p>
              <Button variant="outline" onClick={signOut} className="w-full">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-20 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Console</h1>
            <p className="text-sm text-muted-foreground">
              Manage master data, users, and audit trail
            </p>
          </div>
          <ChangePasswordDialog />
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Master Data
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon className="mr-1.5 h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="resets">
              <KeyRound className="mr-1.5 h-4 w-4" />
              Resets
            </TabsTrigger>
            <TabsTrigger value="audit">
              <History className="mr-1.5 h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <UploadPanel />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersPanel />
          </TabsContent>
          <TabsContent value="resets" className="mt-4">
            <ResetsPanel />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <AuditPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ChangePasswordDialog() {
  const changeFn = useServerFn(changeOwnPassword);
  const auditFn = useServerFn(logAuditEvent);
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await changeFn({ data: { password } });
      await auditFn({ data: { action: "password_reset", details: { self: true } } });
      toast.success("Your password has been updated");
      setPassword("");
      setConfirm("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lock className="mr-1.5 h-4 w-4" /> Change my password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change my password</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={4}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !password || !confirm}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
// Upload panel
// =============================================================
function UploadPanel() {
  const uploadFn = useServerFn(replaceVehicleData);
  const historyFn = useServerFn(getUploadHistory);
  const auditFn = useServerFn(logAuditEvent);
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<{
    status: "success" | "failed";
    filename: string;
    successful: number;
    failed: number;
    message?: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{ filename: string; record_count: number; uploaded_at: string }>
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const r = await historyFn();
      setHistory(r.history ?? []);
    } catch {
      setHistory([]);
    }
  }, [historyFn]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error("Please upload an .xlsx, .xls, or .csv file");
      return;
    }
    setUploading(true);
    setLastUpload(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!json.length) throw new Error("File is empty");

      const headers = Object.keys(json[0]).map((h) => h.trim());
      const required = ["Make", "Model", "Model Variant"];
      for (const r of required) {
        if (!headers.includes(r)) throw new Error(`Missing column: ${r}`);
      }
      const yearCols = headers.filter((h) => /^(19|20)\d{2}$/.test(h));
      if (!yearCols.length) throw new Error("No year columns detected in file");

      const rows: Row[] = [];
      let failedRows = 0;
      for (const raw of json) {
        const norm: Record<string, unknown> = {};
        for (const k of Object.keys(raw)) norm[k.trim()] = raw[k];
        const make = String(norm["Make"] ?? "").trim();
        const model = String(norm["Model"] ?? "").trim();
        const variant = String(norm["Model Variant"] ?? "").trim();
        if (!make || !model || !variant) {
          failedRows += 1;
          continue;
        }
        for (const y of yearCols) {
          const v = norm[y];
          if (v === "" || v === null || v === undefined) continue;
          const num = typeof v === "number" ? v : Number(String(v).replace(/[, ₹]/g, ""));
          if (!Number.isFinite(num) || num <= 0) {
            failedRows += 1;
            continue;
          }
          rows.push({ make, model, variant, year: Number(y), value: num });
        }
      }

      if (!rows.length) throw new Error("No valid value rows found");

      const res = await uploadFn({ data: { filename: file.name, rows } });
      setLastUpload({
        status: "success",
        filename: file.name,
        successful: res.count,
        failed: failedRows,
      });
      toast.success(
        `Uploaded ${res.count.toLocaleString()} rows` +
          (failedRows ? ` • ${failedRows.toLocaleString()} skipped` : ""),
      );
      // Audit
      await auditFn({
        data: {
          action: "upload_master_data",
          details: {
            filename: file.name,
            rows: res.count,
          },
        },
      });

      void loadHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setLastUpload({ status: "failed", filename: file.name, successful: 0, failed: 0, message });
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" /> Upload master file
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload an <code>.xlsx</code> or <code>.csv</code> with columns: Make, Model, Model
            Variant, and year columns (e.g. 2009–2026). Uploading replaces all existing data.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="hidden"
            disabled={uploading}
          />
          <Button
            size="lg"
            className="h-12 w-full"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Upload className="mr-2 h-5 w-5" />
            )}
            {uploading ? "Processing..." : "Choose file & upload"}
          </Button>

          {lastUpload && (
            <div
              className={`rounded-xl border p-3 text-sm ${lastUpload.status === "success" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}
            >
              <div className="flex items-start gap-2">
                {lastUpload.status === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{lastUpload.filename}</div>
                  {lastUpload.status === "success" ? (
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-success">
                        ✓ {lastUpload.successful.toLocaleString()} successful
                      </span>
                      <span
                        className={
                          lastUpload.failed > 0 ? "text-destructive" : "text-muted-foreground"
                        }
                      >
                        {lastUpload.failed > 0 ? (
                          <>✗ {lastUpload.failed.toLocaleString()} failed</>
                        ) : (
                          <>0 failed</>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{lastUpload.message ?? "Upload failed"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base">Upload history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No uploads yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      {h.filename}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.uploaded_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-sm font-semibold">
                    {h.record_count.toLocaleString()} rows
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================
// Users panel
// =============================================================
type UserRow = {
  user_id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  role: string;
};

function UsersPanel() {
  const listFn = useServerFn(listAllUsers);
  const createFn = useServerFn(createUser);
  const toggleFn = useServerFn(setUserActive);
  const deleteFn = useServerFn(deleteUser);
  const resetFn = useServerFn(resetUserPassword);
  const bulkFn = useServerFn(bulkCreateUsers);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const data = await listFn();
      setUsers(data as UserRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreated = async () => {
    setOpenCreate(false);
    await refresh();
  };

  const onToggle = async (u: UserRow) => {
    try {
      await toggleFn({ data: { user_id: u.user_id, is_active: !u.is_active } });
      toast.success(u.is_active ? "User deactivated" : "User activated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onReset = async (u: UserRow) => {
    const input = window.prompt(
      `Reset password for ${u.employee_code}.\n\nEnter a new password (min 4 chars), or leave blank to reset to the Employee Code.`,
      "",
    );
    if (input === null) return;
    const trimmed = input.trim();
    if (trimmed.length > 0 && trimmed.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    try {
      const res = await resetFn({
        data:
          trimmed.length > 0 ? { user_id: u.user_id, password: trimmed } : { user_id: u.user_id },
      });
      toast.success(`Password reset for ${u.employee_code}. New password: ${res.password}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onDelete = async (u: UserRow) => {
    if (!confirm(`Permanently delete user ${u.employee_code}? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { user_id: u.user_id } });
      toast.success("User deleted");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersIcon className="h-4 w-4" /> Branch & admin users
        </CardTitle>
        <div className="flex items-center gap-2">
          <Dialog open={openBulk} onOpenChange={setOpenBulk}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Upload className="mr-1.5 h-4 w-4" /> Bulk Upload
              </Button>
            </DialogTrigger>
            <BulkUploadUsersDialog
              bulkFn={bulkFn}
              onDone={async () => {
                setOpenBulk(false);
                await refresh();
              }}
            />
          </Dialog>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1.5 h-4 w-4" /> Add User
              </Button>
            </DialogTrigger>
            <CreateUserDialog createFn={createFn} onCreated={onCreated} />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users yet.</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li
                key={u.user_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate text-sm font-medium">
                    {u.full_name}
                    {u.role === "admin" && (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                    {!u.is_active && <Badge variant="destructive">Inactive</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {u.employee_code}
                    {u.email ? ` · ${u.email}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReset(u)}
                    title="Reset password"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggle(u)}
                    title={u.is_active ? "Deactivate" : "Activate"}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(u)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CreateUserDialog({
  createFn,
  onCreated,
}: {
  createFn: (args: {
    data: {
      employee_code: string;
      full_name: string;
      email?: string;
      role: "admin" | "branch";
      password?: string;
    };
  }) => Promise<unknown>;
  onCreated: () => void;
}) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "branch">("branch");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await createFn({
        data: {
          employee_code: employeeCode.trim(),
          full_name: fullName.trim(),
          email: email.trim(),
          role,
          password: password.trim() || undefined,
        },
      });
      toast.success(`User created. Password: ${password.trim() || employeeCode}`);
      setEmployeeCode("");
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("branch");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add new user</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>
            Employee Code <span className="text-destructive">*</span>
          </Label>
          <Input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            placeholder="EMP1234"
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email (optional, for contact)</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "admin" | "branch")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="branch">Branch Sales User</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Initial Password</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Defaults to Employee Code"
          />
          <p className="text-xs text-muted-foreground">
            If blank, the password will be the same as the Employee Code.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={loading || !employeeCode || !fullName}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create User
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// =============================================================
// Reset requests panel
// =============================================================
// =============================================================
// Bulk upload users dialog
// =============================================================
function BulkUploadUsersDialog({
  bulkFn,
  onDone,
}: {
  bulkFn: (args: {
    data: {
      rows: Array<{
        employee_code: string;
        full_name: string;
        email?: string;
        role?: string;
        password?: string;
      }>;
    };
  }) => Promise<{
    created: number;
    failed: number;
    results: Array<{ employee_code: string; status: "created" | "failed"; message?: string }>;
  }>;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<null | {
    created: number;
    failed: number;
    failures: Array<{ employee_code: string; message?: string }>;
  }>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { employee_code: "EMP1001", full_name: "Asha Rao", email: "", role: "branch", password: "" },
      {
        employee_code: "EMP1002",
        full_name: "Rahul Singh",
        email: "rahul@itifl.com",
        role: "admin",
        password: "",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "users-bulk-template.xlsx");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setSummary(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const rows = json
        .map((raw) => {
          const norm: Record<string, string> = {};
          for (const k of Object.keys(raw)) {
            norm[k.trim().toLowerCase().replace(/\s+/g, "_")] = String(raw[k] ?? "").trim();
          }
          return {
            employee_code: norm["employee_code"] ?? norm["employeecode"] ?? norm["code"] ?? "",
            full_name: norm["full_name"] ?? norm["fullname"] ?? norm["name"] ?? "",
            email: norm["email"] ?? "",
            role: norm["role"] ?? "",
            password: norm["password"] ?? "",
          };
        })
        .filter((r) => r.employee_code && r.full_name);
      if (!rows.length) {
        toast.error("No valid rows found. Required columns: employee_code, full_name");
        return;
      }
      const res = await bulkFn({ data: { rows } });
      setSummary({
        created: res.created,
        failed: res.failed,
        failures: res.results
          .filter((r) => r.status === "failed")
          .map((r) => ({ employee_code: r.employee_code, message: r.message })),
      });
      if (res.created > 0) {
        toast.success(
          `Created ${res.created} user${res.created === 1 ? "" : "s"}` +
            (res.failed ? ` • ${res.failed} failed` : ""),
        );
      } else {
        toast.error("No users created");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk upload failed");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Bulk upload users</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Upload an Excel (.xlsx) or CSV file. Required columns: <code>employee_code</code>,{" "}
          <code>full_name</code>. Optional: <code>email</code>, <code>role</code> (admin / branch —
          defaults to branch), <code>password</code> (defaults to the Employee Code).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Download template
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            {loading ? "Uploading…" : "Choose file"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onFile}
          />
        </div>
        {summary && (
          <div className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {summary.created} created
              </span>
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-destructive" />
                {summary.failed} failed
              </span>
            </div>
            {summary.failures.length > 0 && (
              <ul className="max-h-40 overflow-auto space-y-1 text-xs">
                {summary.failures.map((f, i) => (
                  <li key={i} className="truncate">
                    <span className="font-medium">{f.employee_code || "(blank)"}</span>
                    <span className="text-muted-foreground"> — {f.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ResetsPanel() {
  const resolveFn = useServerFn(resolvePasswordResetRequest);
  const requestsFn = useServerFn(getPasswordResetRequests);
  const [items, setItems] = useState<
    Array<{
      id: string;
      employee_code: string;
      requested_at: string;
      status: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const r = await requestsFn();
      setItems(r.requests ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [requestsFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (id: string, status: "resolved" | "rejected") => {
    try {
      await resolveFn({ data: { id, status } });
      toast.success(status === "resolved" ? "Marked resolved" : "Rejected");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Password reset requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No password reset requests.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.employee_code}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {new Date(r.requested_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      r.status === "pending"
                        ? "default"
                        : r.status === "resolved"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {r.status}
                  </Badge>
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => act(r.id, "resolved")}>
                        Mark Resolved
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => act(r.id, "rejected")}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================
// Audit log panel
// =============================================================
function AuditPanel() {
  const clearFn = useServerFn(clearAuditLogs);
  const deleteFn = useServerFn(deleteAuditLog);
  const getLogsFn = useServerFn(getAuditLogs);
  const [items, setItems] = useState<
    Array<{
      id: string;
      user_id: string | null;
      employee_code: string | null;
      action: string;
      user_agent: string | null;
      ip: string | null;
      details: unknown;
      created_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const r = await getLogsFn({
        data: {
          action: filter,
        },
      });

      const logs = r.logs ?? [];

      setItems(logs);

      const map: Record<string, string> = {};

      for (const p of logs) {
        if (p.user_id && p.employee_code) {
          map[p.user_id] = p.employee_code;
        }
      }

      setProfilesMap(map);
    } catch {
      setItems([]);
      setProfilesMap({});
    } finally {
      setLoading(false);
    }
  }, [getLogsFn, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDeleteOne = async (id: string) => {
    if (!confirm("Delete this audit log entry? This cannot be undone.")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Entry deleted");
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const onClearAll = async () => {
    const scope = filter === "all" ? "ALL audit log entries" : `all "${filter}" entries`;
    if (!confirm(`Permanently delete ${scope}? This cannot be undone.`)) return;
    setClearing(true);
    try {
      const res = await clearFn({ data: { action: filter } });
      toast.success(`Cleared ${res.deleted.toLocaleString()} entries`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Audit logs
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
              <SelectItem value="search">Searches</SelectItem>
              <SelectItem value="upload_master_data">Uploads</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            disabled={clearing || items.length === 0}
            title={filter === "all" ? "Clear all logs" : `Clear ${filter} logs`}
          >
            {clearing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4 text-destructive" />
            )}
            {filter === "all" ? "Clear all" : "Clear filtered"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.action}</Badge>
                    <span className="font-medium">
                      {r.user_id
                        ? (profilesMap[r.user_id] ?? r.employee_code ?? "Unknown")
                        : (r.employee_code ?? "Anonymous")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onDeleteOne(r.id)}
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {r.details ? (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px] text-muted-foreground">
                    {JSON.stringify(r.details, null, 2)}
                  </pre>
                ) : null}
                {r.user_agent && (
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    UA: {r.user_agent}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
