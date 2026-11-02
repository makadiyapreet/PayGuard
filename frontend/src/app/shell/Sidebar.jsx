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
      { to: "/guided-demo", label: "Guided Viva Demo", icon: PlayCircle },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-[#0d121f] border-r border-slate-800/80 flex flex-col shrink-0 overflow-y-auto">
      <nav className="p-3 flex flex-col gap-6">
        {/* Core items */}
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.layer && <LayerBadge layer={item.layer} />}
            </NavLink>
          ))}
        </div>

        {/* Layer-grouped items */}
        {NAV_ITEMS.slice(2).map((group, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                {group.header}
              </span>
              {group.layer && <LayerBadge layer={group.layer} />}
            </div>

            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-slate-800 text-white font-semibold border border-slate-700"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
