import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { CommandCenter } from "../pages/CommandCenter.jsx";
import { Transfers } from "../pages/Transfers.jsx";

// Layer 1
import { VerificationLab } from "../pages/l1/VerificationLab.jsx";
import { DeploymentInspector } from "../pages/l1/DeploymentInspector.jsx";
import { PreExecutionGate } from "../pages/l1/PreExecutionGate.jsx";

// Layer 2
import { GuardiansApproval } from "../pages/l2/GuardiansApproval.jsx";
import { RiskNetwork } from "../pages/l2/RiskNetwork.jsx";
import { ConsensusTimeline } from "../pages/l2/ConsensusTimeline.jsx";

// Layer 3
import { DefenderMonitor } from "../pages/l3/DefenderMonitor.jsx";
import { DetectionNetwork } from "../pages/l3/DetectionNetwork.jsx";
import { RiskScore } from "../pages/l3/RiskScore.jsx";
import { ChallengeRefund } from "../pages/l3/ChallengeRefund.jsx";

// Management & Labs
import { Governance } from "../pages/Governance.jsx";
import { GasAnalytics } from "../pages/GasAnalytics.jsx";
import { AttackLab } from "../pages/AttackLab.jsx";
import { EventLog } from "../pages/EventLog.jsx";
import { AccountsDevTools } from "../pages/AccountsDevTools.jsx";
import { GuidedDemo } from "../pages/GuidedDemo.jsx";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CommandCenter />} />
      <Route path="/transfers" element={<Transfers />} />

      {/* Layer 1 */}
      <Route path="/l1/verification" element={<VerificationLab />} />
      <Route path="/l1/deployment" element={<DeploymentInspector />} />
      <Route path="/l1/gate" element={<PreExecutionGate />} />

      {/* Layer 2 */}
      <Route path="/l2/guardians" element={<GuardiansApproval />} />
      <Route path="/l2/risk-network" element={<RiskNetwork />} />
      <Route path="/l2/consensus-timeline" element={<ConsensusTimeline />} />

      {/* Layer 3 */}
      <Route path="/l3/defender" element={<DefenderMonitor />} />
      <Route path="/l3/detection" element={<DetectionNetwork />} />
      <Route path="/l3/risk-score" element={<RiskScore />} />
      <Route path="/l3/challenge-refund" element={<ChallengeRefund />} />

      {/* Operations & Labs */}
      <Route path="/governance" element={<Governance />} />
      <Route path="/gas-analytics" element={<GasAnalytics />} />
      <Route path="/attack-lab" element={<AttackLab />} />
      <Route path="/event-log" element={<EventLog />} />
      <Route path="/accounts-devtools" element={<AccountsDevTools />} />
      <Route path="/guided-demo" element={<GuidedDemo />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
