import { useEffect, useState } from "react";

export type HistoryItem = {
  make: string;
  model: string;
  variant: string;
  year: number;
  value: number;
  baseValue: number;
  driveType: string;
  modelType: string;
  usage: string;
  at: number;
};

const KEY = "vvt:history";

export function useSearchHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const add = (item: Omit<HistoryItem, "at">) => {
    const next = [{ ...item, at: Date.now() }, ...items].slice(0, 10);
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const clear = () => {
    setItems([]);
    localStorage.removeItem(KEY);
  };

  return { items, add, clear };
}
