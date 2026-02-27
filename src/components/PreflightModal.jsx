/**
 * PreflightModal — Proxy Pre-flight Check UI
 *
 * Shows animated check progress, trust score gauge, and auto-rotate status
 * when launching a Multilogin profile through NodeMaven proxy.
 *
 * Usage:
 *   <PreflightModal
 *     open={true}
 *     profileId="abc123"
 *     folderId="folder456"
 *     profileName="US Account #1"
 *     geoConfig={{ country: 'us', state: 'California', city: 'Los Angeles' }}
 *     onClose={() => setOpen(false)}
 *     onLaunched={(result) => console.log('Launched!', result)}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from "react";

/* ────── Status Icons ────── */
const STATUS_ICON = {
  pending: "⏳",
  running: "🔄",
  pass: "✅",
  warn: "⚠️",
  fail: "❌",
  skip: "⏭️",
};

const VERDICT_COLOR = {
  AUTO_LAUNCH: "hsl(142, 71%, 45%)",
  WARNING: "hsl(38, 92%, 50%)",
  BLOCKED: "hsl(0, 84%, 60%)",
};

const VERDICT_LABEL = {
  AUTO_LAUNCH: "Auto-Launch",
  WARNING: "Warning",
  BLOCKED: "Blocked",
};

/* ────── Trust Score Gauge (SVG ring) ────── */
function TrustGauge({ score, verdict }) {
  const radius = 52;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - progress);
  const color = VERDICT_COLOR[verdict] || "hsl(220, 14%, 50%)";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(220, 14%, 20%)" strokeWidth={stroke} opacity={0.3} />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold" style={{ color }}>{score}</div>
        <div className="text-[10px] uppercase tracking-wider opacity-70">
          {VERDICT_LABEL[verdict] || "Checking…"}
        </div>
      </div>
    </div>
  );
}

/* ────── Individual Check Row ────── */
function CheckRow({ name, status, detail }) {
  const bg = status === "pass"
    ? "bg-[rgba(16,185,129,0.06)]"
    : status === "fail"
      ? "bg-[rgba(239,68,68,0.06)]"
      : status === "warn"
        ? "bg-[rgba(245,158,11,0.06)]"
        : "bg-transparent";

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-[11px] ${bg} transition-all duration-300`}>
      <span className="text-sm w-5 text-center">{STATUS_ICON[status] || STATUS_ICON.pending}</span>
      <span className="font-medium w-28">{name}</span>
      <span className="text-[hsl(var(--muted-foreground))] flex-1 truncate">{detail || "—"}</span>
    </div>
  );
}

/* ────── Attempt Badge ────── */
function AttemptBadge({ attempt, maxAttempts }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
      <span>Attempt</span>
      {Array.from({ length: maxAttempts }, (_, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < attempt ? "bg-[hsl(var(--accent))]" : "bg-[hsl(var(--border))]"}`} />
      ))}
      <span>{attempt}/{maxAttempts}</span>
    </div>
  );
}

/* ────── Main Modal ────── */
export function PreflightModal({
  open,
  profileId,
  folderId,
  profileName = "Profile",
  geoConfig = {},
  onClose,
  onLaunched,
}) {
  const [phase, setPhase] = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [checks, setChecks] = useState([]);
  const [score, setScore] = useState(0);
  const [verdict, setVerdict] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [maxAttempts] = useState(3);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const preflightRef = useRef(null);

  const cleanup = useCallback(() => {
    if (preflightRef.current) {
      preflightRef.current.removeAllListeners?.();
      preflightRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setStatusMsg("Initializing…");
      setChecks([]);
      setScore(0);
      setVerdict(null);
      setAttempt(0);
      setResult(null);
      setError(null);
    } else {
      cleanup();
    }
  }, [open, cleanup]);

  useEffect(() => {
    if (!open || !profileId || phase !== "idle") return;

    let cancelled = false;

    const run = async () => {
      try {
        const { proxyPreflight } = await import("../services/proxy-preflight.js");
        preflightRef.current = proxyPreflight;

        proxyPreflight.on("status", ({ step, message }) => {
          if (cancelled) return;
          setStatusMsg(message);
          if (step === "rotate") setPhase("checking");
        });

        proxyPreflight.on("check", ({ name, status, detail }) => {
          if (cancelled) return;
          setChecks(prev => {
            const existing = prev.findIndex(c => c.name === name);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { name, status, detail };
              return updated;
            }
            return [...prev, { name, status, detail }];
          });
        });

        proxyPreflight.on("score", ({ score: s, verdict: v }) => {
          if (cancelled) return;
          setScore(s);
          setVerdict(v);
        });

        proxyPreflight.on("attempt", ({ attempt: a }) => {
          if (cancelled) return;
          setAttempt(a);
          setChecks([]);
          setScore(0);
          setVerdict(null);
        });

        setPhase("checking");
        setStatusMsg("Starting pre-flight check…");

        const res = await proxyPreflight.preflightLaunch(
          profileId,
          folderId,
          {
            country: geoConfig.country || "us",
            state: geoConfig.state || "",
            city: geoConfig.city || "",
            filter: geoConfig.filter || "medium",
          }
        );

        if (cancelled) return;

        setResult(res);
        if (res.success) {
          setPhase("launched");
          setStatusMsg(`✅ Profile launched! IP: ${res.ip}`);
          onLaunched?.(res);
        } else {
          setPhase("failed");
          setError(res.error || "Pre-flight check failed");
          setStatusMsg(`❌ ${res.error || "Failed after all attempts"}`);
        }
      } catch (e) {
        if (cancelled) return;
        setPhase("failed");
        setError(e.message);
        setStatusMsg(`❌ ${e.message}`);
      }
    };

    run();
    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profileId]);

  if (!open) return null;

  const isRunning = phase === "checking" || phase === "idle";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_.2s_ease]">
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border))]">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              🛡️ Proxy Pre-flight
              {isRunning && <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--accent))] animate-pulse" />}
            </h3>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{profileName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-lg leading-none disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex justify-center mb-4">
            <TrustGauge score={score} verdict={verdict} />
          </div>

          {attempt > 0 && (
            <div className="flex justify-center mb-3">
              <AttemptBadge attempt={attempt} maxAttempts={maxAttempts} />
            </div>
          )}

          <div className="text-center text-[11px] text-[hsl(var(--muted-foreground))] mb-4">
            {statusMsg}
          </div>

          <div className="flex flex-col gap-1">
            {checks.length === 0 && isRunning && (
              <div className="text-center text-[10px] text-[hsl(var(--muted-foreground))] py-4">
                Initializing checks…
              </div>
            )}
            {checks.map((c, i) => (
              <CheckRow key={`${c.name}-${i}`} name={c.name} status={c.status} detail={c.detail} />
            ))}
          </div>

          {error && phase === "failed" && (
            <div className="mt-4 p-3 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.12)] text-[11px] text-[hsl(var(--destructive))]">
              {error}
            </div>
          )}

          {result?.success && (
            <div className="mt-4 p-3 rounded-lg bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.12)] text-[11px] text-[hsl(var(--success))]">
              <div className="font-medium mb-1">🚀 Profile Launched Successfully</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                <span>IP:</span><span className="font-mono">{result.ip}</span>
                <span>Score:</span><span>{result.score}/100</span>
                <span>Attempts:</span><span>{result.attempts}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
            {geoConfig.country?.toUpperCase() || "US"} {geoConfig.state && `• ${geoConfig.state}`} {geoConfig.city && `• ${geoConfig.city}`}
          </div>
          <div className="flex gap-2">
            {phase === "failed" && (
              <button
                onClick={() => {
                  setPhase("idle");
                  setChecks([]);
                  setScore(0);
                  setVerdict(null);
                  setAttempt(0);
                  setError(null);
                }}
                className="px-3 py-1.5 text-[10px] rounded bg-[hsl(var(--accent))] text-white hover:opacity-90"
              >
                🔄 Retry
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
            >
              {isRunning ? "Cancel" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PreflightModal;
