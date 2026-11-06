import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ShieldCheck,
  CheckCheck,
  ShieldAlert,
  Vote,
  BarChart3,
  Flame,
  ListOrdered,
  Wrench,
  PlayCircle,
  FileCheck,
  Inspect,
  Sliders,
  Users2,
  Activity,
  GitCommit,
  Radio,
  Bot,
  Gauge,
  HelpCircle
} from "lucide-react";
import { LayerBadge } from "../../components/LayerBadge.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Command Center", icon: LayoutDashboard },
  { to: "/transfers", label: "Transfers", icon: ArrowLeftRight, layer: "CORE" },

  // Layer 1
  {
    header: "L1 Before Execution",
    layer: "L1",
    items: [
      { to: "/l1/verification", label: "Verification Lab", icon: FileCheck },
      { to: "/l1/deployment", label: "Deployment Inspector", icon: Inspect },
      { to: "/l1/gate", label: "Pre-Execution Gate", icon: Sliders },
    ],
  },

  // Layer 2
  {
    header: "L2 At Consensus",
    layer: "L2",
    items: [
      { to: "/l2/guardians", label: "Guardians & Approvals", icon: Users2 },
      { to: "/l2/risk-network", label: "Risk Network (RMN)", icon: Activity },
      { to: "/l2/consensus-timeline", label: "Consensus Timeline", icon: GitCommit },
    ],
  },

  // Layer 3
  {
    header: "L3 After Deployment",
    layer: "L3",
    items: [
      { to: "/l3/defender", label: "Defender Monitor", icon: Radio },
      { to: "/l3/detection", label: "Detection Network", icon: Bot },
      { to: "/l3/risk-score", label: "Risk Score & Bands", icon: Gauge },
      { to: "/l3/challenge-refund", label: "Challenge & Refund", icon: ShieldAlert },
    ],
  },

  // Management & Labs
  {
    header: "Operations & Labs",
    items: [
      { to: "/governance", label: "Governance Multi-Sig", icon: Vote },
      { to: "/gas-analytics", label: "Gas & Analytics", icon: BarChart3 },
      { to: "/attack-lab", label: "Attack Lab", icon: Flame },
      { to: "/event-log", label: "Unified Event Log", icon: ListOrdered },
      { to: "/accounts-devtools", label: "Accounts & Dev Tools", icon: Wrench },
      { to: "/guided-demo", label: "Guided Demo Walkthrough", icon: PlayCircle },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white dark:bg-[#0d121f] border-r border-slate-200 dark:border-slate-800/80 flex flex-col shrink-0 overflow-y-auto">
      <nav className="p-3 flex flex-col gap-6">
        {/* Core items */}
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-300 font-bold dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/40 shadow-sm"
                    : "text-slate-800 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.layer && <LayerBadge layer={item.layer} />}
            </NavLink>
          ))}
        </div>

        {/* Layer-grouped items */}
        {NAV_ITEMS.slice(2).map((group, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-3.5 mb-1.5 pt-1">
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-700 dark:text-slate-400">
                {group.header}
              </span>
              {group.layer && <LayerBadge layer={group.layer} />}
            </div>

            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-300 font-bold dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/40 shadow-sm"
                      : "text-slate-800 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

