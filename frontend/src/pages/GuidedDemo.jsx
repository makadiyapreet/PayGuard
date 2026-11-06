import React from "react";
import { LayerBadge } from "../components/LayerBadge.jsx";
import { PlayCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const DEMO_STEPS = [
  {
    step: 1,
    title: "Verify Deployment & Initial State",
    desc: "Confirm 8 contracts, 15 accounts, 100/100 risk score, and 10 ETH per-tx limit.",
    link: "/",
  },
  {
    step: 2,
    title: "Execute Legitimate 2-ETH Transfer",
    desc: "User deposits 2 ETH -> 3 Guardians sign -> 2 RMN bless -> Recipient mints 1.998 pgETH.",
    link: "/transfers",
  },
  {
    step: 3,
    title: "Simulate Forged Signature Attack",
    desc: "Attacker passes forged signatures. Blocked by GuardianRegistry (PG:BAD_SIGS).",
    link: "/l2/guardians",
  },
  {
    step: 4,
    title: "Simulate Nomad Replay Attack",
    desc: "Re-submitting previously executed digest reverts with PG:NOT_PENDING.",
    link: "/transfers",
  },
  {
    step: 5,
    title: "Forta Bot Alert -> Limit Shrinkage",
    desc: "Bot raises High severity alert. Score drops from 100 to 70. Per-tx limit shrinks from 10 to 5 ETH.",
    link: "/l3/risk-score",
  },
  {
    step: 6,
    title: "Defender Rule: Rapid Deposit-Redeem",
    desc: "Rapid deposit followed by immediate redeem trips Defender Rule #2, auto-pausing the bridge.",
    link: "/l3/defender",
  },
  {
    step: 7,
    title: "Multi-Sig Timelock Unpause",
    desc: "Owners submit unpause proposal, confirm (2-of-3), wait 60s timelock, and execute.",
    link: "/governance",
  },
  {
    step: 8,
    title: "Final Solvency Invariant Proof",
    desc: "Verify locked ETH >= pgETH supply across all test runs and demo scenarios.",
    link: "/l1/gate",
  },
];

export function GuidedDemo() {
  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <span>8-Step Guided System Demonstration</span>
          <LayerBadge layer="CORE" />
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
          Structured 5-minute lab presentation walkthrough. Demonstrates all 6 researched solutions in sequence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEMO_STEPS.map((s) => (
          <div
            key={s.step}
            className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 font-mono">
                  STEP {s.step} OF 8
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">{s.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{s.desc}</p>
            </div>

            <Link
              to={s.link}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-600 transition-colors"
            >
              <span>Go to Panel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

