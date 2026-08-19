"use client";

import { useRef, useState, useEffect } from "react";

export function OtpInput({
  length = 6,
  onComplete,
  disabled,
}: {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const code = digits.join("");
    if (code.length === length && !digits.includes("")) {
      onComplete(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  function handleChange(i: number, value: string) {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!pasted) return;
    const next = Array(length).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIndex = Math.min(pasted.length, length - 1);
    refs.current[focusIndex]?.focus();
  }

  function reset() {
    setDigits(Array(length).fill(""));
    refs.current[0]?.focus();
  }

  return (
    <div className="flex justify-center gap-1.5 sm:gap-2.5" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-9 h-11 sm:w-12 sm:h-14 text-lg sm:text-xl font-mono text-center bg-surface border border-border rounded-md outline-none transition-colors duration-300 ease-out focus:border-accent disabled:opacity-50"
        />
      ))}
    </div>
  );
}
