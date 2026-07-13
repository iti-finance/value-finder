import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Search,
  FileDown,
  History,
  Trash2,
  Tractor,
  RotateCcw,
  Factory,
  Calendar,
  Cog,
  Settings2,
  Wrench,
  Briefcase,
  Pencil,
  Plus,
  CalendarClock,
} from "lucide-react";
import {} from /* getAuthToken, decodeJwtPayload */ "@/integrations/auth/client";
import {
  getVehicleMakes,
  getVehicleYears,
  getVehicleModels,
  getVehicleVariants,
  searchVehicle,
  logAuditEvent,
} from "@/lib/vehicle.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppHeader } from "@/components/AppHeader";
import { toast } from "sonner";
import { useSearchHistory } from "@/hooks/use-search-history";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import jsPDF from "jspdf";

function computeAge(manufacturingYear: number) {
  const now = new Date();
  const start = new Date(manufacturingYear, 0, 1);
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) years = 0;
  if (months < 0) months = 0;
  const ageLabel =
    years === 0
      ? `${months} month${months === 1 ? "" : "s"}`
      : months === 0
        ? `${years} year${years === 1 ? "" : "s"}`
        : `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
  const asOnLabel = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return { ageLabel, asOnLabel };
}

export const Route = createFileRoute("/_authenticated/value-finder")({
  head: () => ({
    meta: [
      { title: "ITI Finance Limited" },
      {
        name: "description",
        content: "Look up the funding value of any tractor by make, model, variant and year.",
      },
      { property: "og:title", content: "ITI Finance Limited" },
      { property: "og:description", content: "Instant tractor funding values for the sales team." },
    ],
  }),
  component: Index,
});

function Index() {
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [variant, setVariant] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [driveType, setDriveType] = useState<string>("");
  const [usage, setUsage] = useState<string>("");
  const [result, setResult] = useState<null | {
    make: string;
    model: string;
    variant: string;
    year: number;
    value: number;
    driveType: string;
    baseValue: number;
    modelType: string;
    usage: string;
  }>(null);
  const [loading, setLoading] = useState(false);
  const { items: history, add: addHistory, clear: clearHistory } = useSearchHistory();
  // server function hooks
  const getMakesFn = useServerFn(getVehicleMakes);
  const getYearsFn = useServerFn(getVehicleYears);
  const getModelsFn = useServerFn(getVehicleModels);
  const getVariantsFn = useServerFn(getVehicleVariants);
  const searchFn = useServerFn(searchVehicle);
  const auditFn = useServerFn(logAuditEvent);

  const resetSearch = () => {
    setResult(null);
    setMake("");
    setModel("");
    setVariant("");
    setYear("");
    setDriveType("");
    setUsage("");
  };

  const backToForm = () => {
    setResult(null);
  };

  const makesQ = useQuery({
    queryKey: ["makes"],
    queryFn: async () => {
      const r = await getMakesFn();
      return r.makes ?? [];
    },
  });

  const yearsQ = useQuery({
    queryKey: ["years"],
    queryFn: async () => {
      const r = await getYearsFn();
      return r.years ?? [];
    },
  });

  const modelsQ = useQuery({
    queryKey: ["models", make],
    enabled: !!make,
    queryFn: async () => {
      const r = await getModelsFn({ data: { make } });
      return r.models ?? [];
    },
  });

  const variantsQ = useQuery({
    queryKey: ["variants", make, model],
    enabled: !!make && !!model,
    queryFn: async () => {
      const r = await getVariantsFn({ data: { make, model } });
      return r.variants ?? [];
    },
  });

  const canSubmit = useMemo(
    () => !!make && !!model && !!variant && !!year && !!driveType && !!usage && !loading,
    [make, model, variant, year, driveType, usage, loading],
  );

  const onSearch = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await searchFn({ data: { make, model, variant, year: Number(year) } });
      const data = res.row;
      if (!data) {
        toast.error("No matching record found");
        return;
      }
      const baseValue = Number(data.value);
      let value = driveType === "4WD" ? Math.round(baseValue * 1.1) : baseValue;
      const modelType = data.year <= 2012 ? "Vintage" : "Standard";
      if (modelType === "Vintage") {
        const cap = usage === "Agriculture" ? 150000 : 125000;
        value = Math.min(value, cap);
      }
      const row = {
        make: data.make,
        model: data.model,
        variant: data.variant,
        year: data.year,
        value,
        baseValue,
        driveType,
        modelType,
        usage,
      };
      setResult(row);
      addHistory(row);
      // Audit: log the search action (non-blocking)
      try {
        auditFn({
          data: {
            action: "search",
            details: {
              make: row.make,
              model: row.model,
              variant: row.variant,
              year: row.year,
              driveType: row.driveType,
              usage: row.usage,
              value: row.value,
            },
          },
        });
      } catch {
        /* non-fatal */
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  const exportPDF = () => {
    if (!result) return;
    const { ageLabel, asOnLabel } = computeAge(result.year);
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;

    // Header band
    // Coral red (matches --primary oklch(0.66 0.22 28))
    const coral: [number, number, number] = [230, 88, 60];
    doc.setFillColor(coral[0], coral[1], coral[2]);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Vehicle Financing Grid Report", margin, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString("en-IN"), pageW - margin, 18, { align: "right" });

    // Details section
    let y = 44;
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Vehicle Details", margin, y);
    y += 4;
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const lines: Array<[string, string]> = [
      ["Make", result.make],
      ["Model", result.model],
      ["Variant", result.variant],
      ["Manufacturing Year", String(result.year)],
      [`Vehicle Age (as on ${asOnLabel})`, ageLabel],
      ["Drive Type", result.driveType],
      ["Model Type", result.modelType],
      ["Usage", result.usage],
    ];
    const rowH = 9;
    const labelX = margin;
    const valueX = margin + 70;
    doc.setFontSize(11);
    lines.forEach(([k, v], i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin - 2, y - 6, pageW - margin * 2 + 4, rowH, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110);
      doc.text(k, labelX, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      const wrapped = doc.splitTextToSize(v, pageW - valueX - margin);
      doc.text(wrapped, valueX, y);
      y += rowH;
    });

    // Estimated value card
    y += 14;
    const cardH = 38;
    doc.setFillColor(coral[0], coral[1], coral[2]);
    doc.roundedRect(margin, y, pageW - margin * 2, cardH, 4, 4, "F");
    doc.setTextColor(255, 230, 222);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("ESTIMATED GRID VALUE", margin + 6, y + 12);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(result.value);
    doc.text(`Rs. ${inr}`, margin + 6, y + 30);

    if (result.driveType === "4WD") {
      const baseInr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
        result.baseValue,
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Base Rs. ${baseInr} + 10% (4WD)`, pageW - margin - 6, y + 30, { align: "right" });
    }

    // Footer
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("ITI Finance Limited — Confidential", margin, pageH - 10);
    doc.text("Page 1 of 1", pageW - margin, pageH - 10, { align: "right" });

    doc.save(`valuation-${result.make}-${result.year}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        rightSlot={
          <>
            {result && (
              <Button variant="ghost" size="icon" onClick={resetSearch} aria-label="New search">
                <Plus className="h-5 w-5" />
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Recent searches"
                  className="relative"
                >
                  <History className="h-5 w-5" />
                  {history.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {history.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <History className="h-4 w-4" />
                    Recent Searches
                  </div>
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearHistory}
                      aria-label="Clear history"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto p-2">
                  {history.length === 0 ? (
                    <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No recent searches yet.
                    </div>
                  ) : (
                    history.map((h) => (
                      <button
                        key={h.at}
                        className="w-full rounded-lg border bg-card p-2.5 text-left transition hover:bg-accent"
                        onClick={() => setResult(h)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {h.make} · {h.model}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {h.variant} · {h.year}
                            </div>
                          </div>
                          <div className="ml-2 shrink-0 text-sm font-semibold text-primary">
                            {formatINR(h.value)}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </>
        }
      />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
        <div className="relative mb-6 rounded-3xl bg-primary p-6 text-primary-foreground shadow-[var(--shadow-card)]">
          <h1 className="text-center text-2xl font-bold">ITI Finance Limited</h1>
          <p className="mt-1 text-center text-sm opacity-90">
            Get an instant estimate grid value for any vehicle in our database.
          </p>
        </div>

        {!result && (
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Make">
                <Select
                  value={make}
                  onValueChange={(v) => {
                    setMake(v);
                    setModel("");
                    setVariant("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={makesQ.isLoading ? "Loading..." : "Select make"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(makesQ.data ?? []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Model">
                <Select
                  value={model}
                  onValueChange={(v) => {
                    setModel(v);
                    setVariant("");
                  }}
                  disabled={!make}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!make ? "Select make first" : "Select model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(modelsQ.data ?? []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Variant">
                <Select value={variant} onValueChange={setVariant} disabled={!model}>
                  <SelectTrigger>
                    <SelectValue placeholder={!model ? "Select model first" : "Select variant"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(variantsQ.data ?? []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="YEAR OF MANUFACTURE">
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue placeholder={yearsQ.isLoading ? "Loading..." : "Select year"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(yearsQ.data ?? []).map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="WHEEL DRIVE TYPE">
                <Select value={driveType} onValueChange={setDriveType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wheel drive type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2WD">2WD</SelectItem>
                    <SelectItem value="4WD">4WD (+10%)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Usage of Vehicle">
                <Select value={usage} onValueChange={setUsage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select usage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Agriculture">Agriculture</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Button
                size="lg"
                className="h-12 w-full text-base"
                onClick={onSearch}
                disabled={!canSubmit}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Search className="mr-2 h-5 w-5" />
                )}
                Get Value
              </Button>
            </CardContent>
          </Card>
        )}

        {result && (
          <section className="mt-6 space-y-4">
            {/* Hero Funding Value Card */}
            <Card className="relative overflow-hidden border-0 bg-card shadow-[var(--shadow-card)]">
              <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-[0.06]" />
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
              <CardContent className="relative p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Estimated Grid Value
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <Tractor className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-4xl font-extrabold leading-tight text-primary">
                          {formatINR(result.value)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold " +
                      (result.modelType === "Vintage"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-emerald-100 text-emerald-700")
                    }
                  >
                    {result.modelType} Model
                  </span>
                </div>

                {result.driveType === "4WD" && (
                  <div className="mt-3 rounded-lg border border-dashed border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
                    Base {formatINR(result.baseValue)} + 10% uplift for 4WD
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button className="h-11" onClick={exportPDF}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button variant="outline" className="h-11" onClick={backToForm}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Kpi icon={<Factory className="h-4 w-4" />} label="Make" value={result.make} />
              <Kpi icon={<Wrench className="h-4 w-4" />} label="Model" value={result.model} />
              <Kpi
                icon={<Settings2 className="h-4 w-4" />}
                label="Variant"
                value={result.variant}
                className="col-span-2 sm:col-span-1"
              />
              <Kpi
                icon={<Calendar className="h-4 w-4" />}
                label="Year"
                value={String(result.year)}
              />
              <Kpi icon={<Cog className="h-4 w-4" />} label="Drive Type" value={result.driveType} />
              <Kpi icon={<Briefcase className="h-4 w-4" />} label="Usage" value={result.usage} />
              {(() => {
                const { ageLabel, asOnLabel } = computeAge(result.year);
                return (
                  <Kpi
                    icon={<CalendarClock className="h-4 w-4" />}
                    label={`Vehicle Age (as on ${asOnLabel})`}
                    value={ageLabel}
                    className="col-span-2 sm:col-span-3"
                  />
                );
              })()}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={
        "group rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:shadow-md " +
        (className ?? "")
      }
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}
