import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * ADMIN.MEDIA.1 (ITEM 0) — modern sectioned admin shell.
 *
 * Provides the chrome (dark/gold header + section navigation) and renders the
 * active section's content. Deliberately a *wrapper*: existing admin panels are
 * re-parented into sections here without being rewritten (full decomposition of
 * the gallery monolith is a later sprint). Only the active section is mounted,
 * so a section's data fetches / fixed docks never bleed across tabs.
 *
 * Mobile-friendly: the nav is a horizontally-scrollable pill bar under 768px and
 * a wrap-friendly row above it.
 */
export type AdminSection = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

type Props = {
  title: string;
  subtitle: string;
  logOutLabel: string;
  sections: AdminSection[];
  onSignOut: () => void;
};

const AdminShell = ({ title, subtitle, logOutLabel, sections, onSignOut }: Props) => {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div data-qa="admin-shell" className="max-w-6xl mx-auto px-4 pt-28 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="outline" onClick={onSignOut} className="shrink-0">
          {logOutLabel}
        </Button>
      </div>

      {/* Section navigation */}
      <nav
        data-qa="admin-nav"
        aria-label={title}
        className="flex gap-2 overflow-x-auto pb-1 mb-8 border-b border-border scrollbar-none"
      >
        {sections.map((s) => {
          const isActive = s.id === active?.id;
          return (
            <button
              key={s.id}
              type="button"
              data-qa={`admin-nav-${s.id}`}
              onClick={() => setActiveId(s.id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex items-center gap-2 whitespace-nowrap rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span aria-hidden className="[&>svg]:w-4 [&>svg]:h-4">
                {s.icon}
              </span>
              {s.label}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Active section */}
      {active && (
        <section data-qa={`admin-section-${active.id}`} aria-label={active.label}>
          {active.content}
        </section>
      )}
    </div>
  );
};

export default AdminShell;
