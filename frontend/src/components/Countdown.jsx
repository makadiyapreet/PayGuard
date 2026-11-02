import React, { useEffect, useState } from "react";
import { getChainNow } from "../lib/time.js";

export function Countdown({ targetTimestamp, onExpired, label = "remaining" }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = getChainNow();
      const diff = Number(targetTimestamp) - now;
      if (diff <= 0) {
        setRemaining(0);
        if (onExpired) onExpired();
      } else {
        setRemaining(diff);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetTimestamp, onExpired]);

  if (remaining <= 0) {
    return <span className="text-emerald-400 font-mono text-xs font-semibold">Ready / Elapsed</span>;
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins > 0 ? `${mins}m ` : ""}${secs}s`;

  return (
    <span className="font-mono text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
      ⏳ {timeStr} {label}
    </span>
  );
}
