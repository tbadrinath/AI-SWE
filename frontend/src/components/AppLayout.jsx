import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Boxes,
  Hammer,
  PlayCircle,
  Layers,
  Download,
  Cpu,
  Activity,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, testid: "nav-dashboard" },
  { to: "/models", label: "Models", icon: Boxes, testid: "nav-models" },
  { to: "/tasks", label: "Task Builder", icon: Hammer, testid: "nav-tasks" },
  { to: "/runs", label: "Runs", icon: PlayCircle, testid: "nav-runs" },
  { to: "/phases", label: "Phases", icon: Layers, testid: "nav-phases" },
  { to: "/download", label: "Download Agent", icon: Download, testid: "nav-download" },
];

export default function AppLayout() {
  const location = useLocation();
  const active = NAV.find((n) => n.to === location.pathname) || NAV[0];

  return (
    <div className="min-h-screen bg-[var(--ab-bg)] text-[var(--ab-text)]">
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-900 bg-white px-6 py-3"
        data-testid="top-header"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-6 bg-[var(--ab-klein-blue)]">
              <div className="absolute inset-[3px] bg-white" />
              <div className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 bg-[var(--ab-klein-blue)]" />
            </div>
            <span className="font-heading text-lg font-black tracking-tight">
              AGENTIC&nbsp;BUILDER
            </span>
          </div>
          <span className="overline hidden md:inline">
            / control plane &middot; v0.1 &middot; phase 1
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 border border-neutral-900 px-2 py-1 md:flex">
            <Cpu className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="font-mono text-[11px] uppercase tracking-wider">
              HF LOCAL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="pulse-dot h-2 w-2 bg-[var(--ab-success-green)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">
              ONLINE
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        {/* Sidebar */}
        <aside
          className="sticky top-[49px] hidden h-[calc(100vh-49px)] w-56 shrink-0 border-r border-neutral-200 md:block"
          data-testid="sidebar"
        >
          <nav className="flex flex-col">
            {NAV.map(({ to, label, icon: Icon, testid }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                data-testid={testid}
                className={({ isActive }) =>
                  `flex items-center gap-3 border-b border-neutral-200 px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--ab-klein-blue)] text-white"
                      : "text-neutral-900 hover:bg-neutral-100"
                  }`
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span className="font-medium">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4">
            <div className="overline mb-2">System</div>
            <div className="space-y-1 text-[11px] font-mono text-neutral-600">
              <div className="flex justify-between">
                <span>cache</span><span>~/.hf/hub</span>
              </div>
              <div className="flex justify-between">
                <span>vision</span>
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3 w-3" /> OpenCV
                </span>
              </div>
              <div className="flex justify-between">
                <span>browser</span><span>Playwright</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1" data-testid="main-content">
          <div className="border-b border-neutral-200 bg-white px-6 py-4 md:px-10">
            <div className="overline" data-testid="page-section">
              {active.label}
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tight md:text-4xl">
              {pageTitle(active.to)}
            </h1>
          </div>
          <div className="px-6 py-6 md:px-10 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function pageTitle(path) {
  switch (path) {
    case "/":
      return "Autonomous Run Console";
    case "/models":
      return "Local Hugging Face Registry";
    case "/tasks":
      return "Task Builder";
    case "/runs":
      return "Run History";
    case "/phases":
      return "Phase Progression";
    case "/download":
      return "Download Phase 1 Agent";
    default:
      return "Agentic Builder";
  }
}
