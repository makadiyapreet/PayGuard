import { formatEther, formatUnits } from "ethers";

export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatEth(val, decimals = 4) {
  if (val === undefined || val === null) return "--";
  try {
    const s = typeof val === "bigint" ? formatEther(val) : String(val);
    const n = parseFloat(s);
    if (isNaN(n)) return "--";
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  } catch (e) {
    return String(val);
  }
}

export function formatGwei(val) {
  if (!val) return "0";
  try {
    return formatUnits(val, "gwei");
  } catch {
    return String(val);
  }
}

export function formatDateTime(ts) {
  if (!ts) return "--";
  const ms = typeof ts === "number" && ts < 1e12 ? ts * 1000 : Number(ts);
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
