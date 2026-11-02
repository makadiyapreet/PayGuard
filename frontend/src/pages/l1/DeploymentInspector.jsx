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

      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
          Architecture Contracts Registry
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3">Contract</th>
                <th className="py-2.5 px-3">Layer</th>
                <th className="py-2.5 px-3">Researched Solution</th>
                <th className="py-2.5 px-3">Address</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {Object.entries(contracts).map(([name, data]) => (
                <tr key={name} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 text-white font-bold">{name}</td>
                  <td className="py-3 px-3">
                    <LayerBadge layer={data.layer} />
                  </td>
                  <td className="py-3 px-3 text-slate-300">{data.solution}</td>
                  <td className="py-3 px-3 text-blue-400 select-all">{data.address}</td>
                  <td className="py-3 px-3">
                    <span className="text-emerald-400 flex items-center gap-1 font-bold text-[11px]">
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

