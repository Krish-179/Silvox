"use client";

import { useEffect, useState } from "react";

interface BudgetGaugeProps {
  target: number;
  limit?: number | null;
  size?: number;
}

export function BudgetGauge({ target, limit, size = 220 }: BudgetGaugeProps) {
  const [value, setValue] = useState(0);
  const hasLimit = typeof limit === "number" && limit > 0;

  useEffect(() => {
    let frame: number;
    const duration = 1600;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      setValue(target * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const effectiveLimit = hasLimit
    ? (limit as number)
    : Math.max(target * 1.4, 10);
  const pct = Math.min(value / effectiveLimit, 1);
  const angle = -120 + pct * 240;
  const radius = 80;
  const cx = 100,
    cy = 100;
  const isHot = hasLimit && pct > 0.55;

  const polarToCartesian = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  const arcPath = (startDeg: number, endDeg: number) => {
    const start = polarToCartesian(startDeg);
    const end = polarToCartesian(endDeg);
    const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const isBlockZone = hasLimit && pct > 0.85;
  const strokeColor = isBlockZone
    ? "rgb(var(--color-block))"
    : hasLimit
      ? "rgb(var(--color-accent))"
      : "rgb(var(--color-muted))";

  return (
    <svg
      viewBox="0 0 200 160"
      style={{ width: size, maxWidth: "100%", overflow: "visible" }}
    >
      <defs>
        <filter id="gaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={isHot ? 4 : 0} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={arcPath(-120, 120)}
        fill="none"
        style={{ stroke: "rgb(var(--color-border))" }}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={arcPath(-120, angle)}
        fill="none"
        stroke={strokeColor}
        strokeWidth="10"
        strokeLinecap="round"
        filter="url(#gaugeGlow)"
        style={{ transition: "stroke 0.4s ease" }}
      />
      {hasLimit && (
        <line
          x1={polarToCartesian(120).x}
          y1={polarToCartesian(120).y}
          x2={cx + (radius + 8) * Math.cos(((120 - 90) * Math.PI) / 180)}
          y2={cy + (radius + 8) * Math.sin(((120 - 90) * Math.PI) / 180)}
          style={{ stroke: "rgb(var(--color-muted))" }}
          strokeWidth="2"
        />
      )}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="font-mono"
        fontSize="30"
        fontWeight="600"
        style={{ fill: "rgb(var(--color-text))" }}
      >
        ${value.toFixed(2)}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        className="font-sans"
        fontSize="11"
        letterSpacing="0.05em"
        style={{ fill: "rgb(var(--color-muted))" }}
      >
        {hasLimit
          ? `OF $${effectiveLimit.toFixed(0)} LIMIT`
          : "NO BUDGET RULE SET"}
      </text>
    </svg>
  );
}
