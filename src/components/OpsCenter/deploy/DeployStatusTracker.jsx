/**
 * Deploy Status Tracker
 * =====================
 * Real-time GitHub Actions workflow status display.
 * Polls workflow run status and shows step-by-step progress
 * so employees don't need GitHub access.
 */

import { useState, useEffect, useRef } from "react";
import { THEME as T } from "../../../constants";
import { createDeployTracker } from "../../../utils/deployers/github-status";

const PHASE_CONFIG = {
  not_found: { icon: "⏳", color: T.muted,   label: "Waiting",     spin: true  },
  queued:    { icon: "⏳", color: T.warning,  label: "Queued",      spin: true  },
  waiting:   { icon: "⏳", color: T.warning,  label: "Waiting",     spin: true  },
  in_progress: { icon: "🔄", color: T.primary, label: "Building",  spin: true  },
  completed: { icon: "✅", color: T.success,  label: "Success",     spin: false },
  failed:    { icon: "❌", color: T.danger,   label: "Failed",      spin: false },
  cancelled: { icon: "⚪", color: T.muted,    label: "Cancelled",   spin: false },
};

const S = {
  container: {
    marginTop: 12,
    padding: 16,
    borderRadius: 10,
    border: `1px solid ${T.border}`,
    background: T.card,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  phaseLabel: (color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    color,
  }),
  duration: {
    fontSize: 11,
    color: T.muted,
    fontFamily: "monospace",
  },
  message: {
    fontSize: 12,
    color: T.text,
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    background: T.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: (pct, color) => ({
    height: "100%",
    width: `${pct}%`,
    background: color,
    borderRadius: 3,
    transition: "width 0.5s ease",
  }),
  stepsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 12,
  },
  step: (isActive, isDone, isFailed) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    color: isActive ? T.primary : isDone ? T.success : isFailed ? T.danger : T.muted,
    fontWeight: isActive ? 600 : 400,
    padding: "3px 0",
  }),
  stepDot: (isActive, isDone, isFailed) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    background: isDone ? T.success : isFailed ? T.danger : isActive ? T.primary : T.border,
    ...(isActive ? { boxShadow: `0 0 6px ${T.primary}` } : {}),
  }),
  linkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    fontSize: 11,
  },
  link: {
    color: T.primary,
    textDecoration: "none",
    fontSize: 11,
  },
  trackingBanner: (ok) => ({
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 11,
    background: ok ? `${T.success}12` : `${T.danger}12`,
    border: `1px solid ${ok ? `${T.success}40` : `${T.danger}40`}`,
    color: ok ? T.success : T.danger,
  }),
  closeBtn: {
    background: "none",
    border: "none",
    color: T.muted,
    cursor: "pointer",
    fontSize: 14,
    padding: 4,
  },
};

function formatDuration(sec) {
  if (!sec || sec < 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function DeployStatusTracker({ githubToken, repo, commitSha, domain, onClose }) {
  const [status, setStatus] = useState(null);
  const trackerRef = useRef(null);

  useEffect(() => {
    if (!githubToken || !repo || !commitSha) return;

    const tracker = createDeployTracker({ githubToken, repo, commitSha });
    trackerRef.current = tracker;

    tracker.onStatus((s) => setStatus(s));
    tracker.start();

    return () => tracker.stop();
  }, [githubToken, repo, commitSha]);

  if (!status) {
    return (
      <div style={S.container}>
        <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 8 }}>
          Connecting to GitHub Actions...
        </div>
      </div>
    );
  }

  const phase = PHASE_CONFIG[status.phase] || PHASE_CONFIG.not_found;
  const isDone = status.phase === "completed" || status.phase === "failed" || status.phase === "cancelled";
  const progressPct = status.steps?.percent ?? (isDone ? 100 : status.phase === "in_progress" ? 50 : 10);
  const pixelHost = domain ? `t.${String(domain).trim().toLowerCase()}` : null;
  const pixelUrl = pixelHost ? `https://${pixelHost}/e` : null;
  const trackingOk = status.steps?.trackingOk === true;
  const trackingFailed = Boolean(status.steps?.trackingFailedStep);

  return (
    <div style={{
      ...S.container,
      borderColor: isDone
        ? (status.phase === "completed" ? `${T.success}60` : `${T.danger}60`)
        : T.border,
    }}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.phaseLabel(phase.color)}>
          <span style={phase.spin ? { animation: "spin 1.5s linear infinite", display: "inline-block" } : {}}>
            {phase.icon}
          </span>
          <span>GitHub Actions: {phase.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {status.durationSec != null && (
            <span style={S.duration}>{formatDuration(status.durationSec)}</span>
          )}
          {isDone && onClose && (
            <button style={S.closeBtn} onClick={onClose} title="Dismiss">✕</button>
          )}
        </div>
      </div>

      {/* Status message */}
      <div style={S.message}>{status.message}</div>

      {/* Progress bar */}
      <div style={S.progressBar}>
        <div style={S.progressFill(progressPct, phase.color)} />
      </div>

      {/* Step-level progress */}
      {status.steps?.steps && (
        <div style={S.stepsContainer}>
          {status.steps.steps.map((step, i) => {
            const isActive = step.status === "in_progress";
            const isDoneStep = step.status === "completed" && step.conclusion === "success";
            const isFailed = step.conclusion === "failure";
            const isSkipped = step.conclusion === "skipped";
            const isTrackingStep = /pixel|tracking/i.test(step.name);

            if (isSkipped) return null;

            return (
              <div key={i} style={{
                ...S.step(isActive, isDoneStep, isFailed),
                ...(isTrackingStep ? { fontWeight: 600 } : {}),
              }}>
                <div style={S.stepDot(isActive, isDoneStep, isFailed)} />
                <span>{step.name}</span>
                {isDoneStep && <span style={{ color: T.success, fontSize: 10 }}>done</span>}
                {isFailed && <span style={{ color: T.danger, fontSize: 10 }}>failed</span>}
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>
            {status.steps.completed}/{status.steps.total} steps completed
          </div>
        </div>
      )}

      {isDone && pixelUrl && status.phase === "completed" && trackingOk && (
        <div style={S.trackingBanner(true)}>
          Pixel tracking verified — <a href={pixelUrl} target="_blank" rel="noopener" style={S.link}>{pixelUrl}</a>
        </div>
      )}
      {isDone && trackingFailed && (
        <div style={S.trackingBanner(false)}>
          Tracking step failed: {status.steps.trackingFailedStep}. Check Workers route {pixelHost ? `${pixelHost}/*` : 't.{domain}/*'} → lp-factory-api.
        </div>
      )}

      {/* Links */}
      <div style={S.linkRow}>
        {status.runUrl && (
          <a href={status.runUrl} target="_blank" rel="noopener" style={S.link}>
            View on GitHub
          </a>
        )}
        {status.deployUrl && (
          <a href={status.deployUrl} target="_blank" rel="noopener" style={S.link}>
            Open deployed site
          </a>
        )}
      </div>
    </div>
  );
}
