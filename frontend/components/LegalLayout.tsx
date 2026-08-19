import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { nav } from "framer-motion/client";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

export function LegalLayout({
  icon: Icon,
  title,
  lastUpdated,
  sections,
  crossLinkHref,
  crossLinkLabel,
}: {
  icon: React.ElementType;
  title: string;
  lastUpdated: string;
  sections: Section[];
  crossLinkHref: string;
  crossLinkLabel: string;
}) {
  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Simple top bar, consistent across both legal pages */}
      <header className="border-b border-border px-6 sm:px-10 lg:px-16 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-accent">
              <span className="font-mono text-xs font-semibold text-bg">
                SV
              </span>
            </div>
            <span className="font-display text-lg" style={{ fontWeight: 500 }}>
              Silvox
            </span>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors duration-300 ease-out mb-8"
        >
          <ArrowLeft size={13} />
          Back to home
        </Link>
        {/* Page heading */}
        <div className="mb-12 lg:mb-16 max-w-2xl">
          <h1
            className="font-display text-3xl sm:text-4xl mb-3"
            style={{ fontWeight: 500 }}
          >
            {title}
          </h1>
          <p className="text-muted text-sm">
            Last updated: {lastUpdated} — placeholder content, finalized before
            public launch.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12 lg:gap-16">
          {/* Desktop sticky section nav — hidden on mobile, where sections just stack in reading order */}
          <nav className="hidden lg:block">
            <div className="sticky top-16">
              <div className="text-xs uppercase tracking-widest text-muted mb-4">
                On this page
              </div>
              <ul className="space-y-3 border-l border-border">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block pl-4 -ml-px text-sm text-muted hover:text-accent border-l border-transparent hover:border-accent transition-colors duration-300 ease-out"
                    >
                      <span className="font-mono text-xs text-muted/60 mr-1.5">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-8 border-t border-border">
                <Link
                  href={crossLinkHref}
                  className="text-sm text-accent hover:underline"
                >
                  {crossLinkLabel} →
                </Link>
              </div>
            </div>
          </nav>

          {/* Content */}
          <div className="max-w-2xl space-y-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-16">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-mono text-sm text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-text text-xl font-medium">{s.title}</h2>
                </div>
                <div className="text-[15px] text-muted leading-relaxed">
                  {s.content}
                </div>
              </section>
            ))}

            {/* Mobile-only cross-link — desktop already has it in the sidebar */}
            <div className="lg:hidden pt-8 border-t border-border">
              <Link
                href={crossLinkHref}
                className="text-sm text-accent hover:underline"
              >
                {crossLinkLabel} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
