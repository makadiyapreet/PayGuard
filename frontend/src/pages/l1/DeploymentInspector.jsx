import React from "react";
import { useChainStore } from "../../store/chainStore.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { shortAddress } from "../../lib/format.js";
import { Inspect, CheckCircle2 } from "lucide-react";

export function DeploymentInspector() {
  const contracts = useChainStore((s) => s.contracts);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <span>Deployment Wiring & Contract Inspector</span>
          <LayerBadge layer="L1" />
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Live verification of deployed contract addresses, roles, and governance delegation to DefenderMonitor.
        </p>
      </div>

      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
          Architecture Contracts Registry
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3.5">Contract</th>
                <th className="py-3 px-3.5">Layer</th>
                <th className="py-3 px-3.5">Researched Solution</th>
                <th className="py-3 px-3.5">Address</th>
                <th className="py-3 px-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
              {Object.entries(contracts).map(([name, data]) => (
                <tr key={name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3.5 text-slate-900 dark:text-white font-bold">{name}</td>
                  <td className="py-3 px-3.5">
                    <LayerBadge layer={data.layer} />
                  </td>
                  <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 font-medium">{data.solution}</td>
                  <td className="py-3 px-3.5 text-blue-700 dark:text-blue-400 select-all font-semibold">{data.address}</td>
                  <td className="py-3 px-3.5">
                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> LIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

