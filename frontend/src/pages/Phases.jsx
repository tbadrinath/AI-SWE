import React, { useEffect, useState } from "react";
import { endpoints } from "../lib/api";
import { CheckCircle2, CircleDashed, Layers } from "lucide-react";

export default function Phases() {
  const [phases, setPhases] = useState([]);

  useEffect(() => {
    endpoints.listPhases().then((r) => setPhases(r.phases));
  }, []);

  return (
    <div className="border border-neutral-900" data-testid="phases-root">
      {phases.map((p, idx) => {
        const active = p.status === "active";
        return (
          <div
            key={p.id}
            className={`grid grid-cols-1 md:grid-cols-12 ${idx !== phases.length - 1 ? "border-b border-neutral-900" : ""}`}
            data-testid={`phase-${p.id}`}
          >
            <div
              className={`flex items-center gap-3 md:col-span-3 md:border-r md:border-neutral-900 p-6 ${active ? "bg-[var(--ab-klein-blue)] text-white" : "bg-white"}`}
            >
              <Layers className="h-4 w-4" strokeWidth={1.5} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider opacity-80">
                  {p.id}
                </div>
                <div className="font-heading text-lg font-black tracking-tight">
                  {p.name.split("—")[1]?.trim() || p.name}
                </div>
              </div>
            </div>
            <div className="md:col-span-7 p-6">
              <div className="overline mb-2">features</div>
              <ul className="space-y-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 font-mono text-[12px]">
                    <span className="h-1.5 w-1.5 bg-neutral-900" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-end md:col-span-2 md:border-l md:border-neutral-900 p-6">
              {active ? (
                <span className="inline-flex items-center gap-1.5 text-[var(--ab-klein-blue)]">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-wider">active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-neutral-500">
                  <CircleDashed className="h-4 w-4" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-wider">planned</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
