"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Gauge as GaugeIcon,
  SlidersHorizontal,
  KeyRound,
  ScrollText,
  CreditCard,
  LogOut,
} from "lucide-react";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", Icon: GaugeIcon },
  { label: "Rules", href: "/rules", Icon: SlidersHorizontal },
  { label: "Keys", href: "/keys", Icon: KeyRound },
  { label: "Log", href: "/log", Icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const billingActive = pathname === "/billing";

  async function handleLogout() {
    await api.logout().catch(() => {});
    router.push("/login");
  }

  return (
    <>
      {/* Desktop — fixed vertical rail, own column, never scrolls with content */}
      <div className="hidden md:flex flex-col items-center w-16 py-6 gap-8 shrink-0 bg-nav border-r border-border h-screen">
        <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-accent shrink-0">
          <span className="font-mono text-xs font-semibold text-bg">SV</span>
        </div>
        <nav className="flex flex-col gap-6 mt-4">
          {NAV_ITEMS.map(({ label, href, Icon }) => {
            const active = pathname === href;
            return (
              <button
                key={label}
                onClick={() => router.push(href)}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: active
                      ? "rgb(var(--color-accent) / 0.15)"
                      : "transparent",
                    border: active
                      ? "1px solid rgb(var(--color-accent))"
                      : "1px solid transparent",
                  }}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={active ? "text-accent" : "text-muted"}
                  />
                </div>
                <span
                  className={`text-[9px] tracking-wide uppercase ${active ? "text-text" : "text-muted"}`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => router.push("/billing")}
          className="mt-auto flex flex-col items-center gap-1.5 mb-2"
          aria-label="Billing"
        >
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center transition-colors duration-300 ease-out"
            style={{
              backgroundColor: billingActive
                ? "rgb(var(--color-accent) / 0.15)"
                : "transparent",
              border: billingActive
                ? "1px solid rgb(var(--color-accent))"
                : "1px solid transparent",
            }}
          >
            <CreditCard
              size={16}
              strokeWidth={1.75}
              className={billingActive ? "text-accent" : "text-muted"}
            />
          </div>
          <span
            className={`text-[9px] tracking-wide uppercase ${billingActive ? "text-text" : "text-muted"}`}
          >
            Billing
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="text-muted hover:text-block transition-colors duration-300 ease-out mb-2"
          aria-label="Log out"
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Mobile — fixed bottom tab bar, standard mobile nav convention */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-nav border-t border-border flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50">
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = pathname === href;
          return (
            <button
              key={label}
              onClick={() => router.push(href)}
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <Icon
                size={20}
                strokeWidth={1.75}
                className={active ? "text-accent" : "text-muted"}
              />
              <span
                className={`text-[10px] ${active ? "text-text" : "text-muted"}`}
              >
                {label}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => router.push("/billing")}
          className="flex flex-col items-center gap-1 px-3 py-1"
        >
          <CreditCard
            size={20}
            strokeWidth={1.75}
            className={billingActive ? "text-accent" : "text-muted"}
          />
          <span
            className={`text-[10px] ${billingActive ? "text-text" : "text-muted"}`}
          >
            Billing
          </span>
        </button>
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-3 py-1"
        >
          <LogOut size={20} strokeWidth={1.75} className="text-muted" />
          <span className="text-[10px] text-muted">Log out</span>
        </button>
      </nav>
    </>
  );
}
