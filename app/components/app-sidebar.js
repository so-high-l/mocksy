"use client";

import Link from "next/link";
import { Gauge, Images, Layers3, Search, Settings, Workflow } from "lucide-react";
import { usePathname } from "next/navigation";
import { FEATURE_MODULES, MAIN_WORKFLOW } from "../../lib/features";

const ICONS = { gauge: Gauge, images: Images, search: Search };

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <Link className="sidebar-brand" href="/" aria-label="Mocksy home">
        <span className="brand-mark"><Layers3 size={17} strokeWidth={2.4} /></span>
        <span>mocksy</span>
      </Link>

      <Link
        className={`sidebar-workflow-preview ${pathname === MAIN_WORKFLOW.href ? "is-active" : ""}`}
        href={MAIN_WORKFLOW.href}
        aria-current={pathname === MAIN_WORKFLOW.href ? "page" : undefined}
      >
        <span><Workflow size={16} /></span>
        <div><strong>{MAIN_WORKFLOW.label}</strong><small>Artwork to Etsy draft</small></div>
      </Link>

      <nav className="sidebar-tools" aria-label="Modular Etsy tools">
        <span className="sidebar-label">Modules</span>
        {FEATURE_MODULES.map((tool) => {
          const Icon = ICONS[tool.icon];
          const active = pathname === tool.href;
          return (
            <Link key={tool.href} className={active ? "is-active" : ""} href={tool.href} aria-current={active ? "page" : undefined}>
              <span className="sidebar-tool-icon"><Icon size={17} /></span>
              <span><strong>{tool.label}</strong><small>{tool.note}</small></span>
            </Link>
          );
        })}
      </nav>

      <Link className={`sidebar-settings ${pathname === "/settings" ? "is-active" : ""}`} href="/settings">
        <Settings size={16} />
        <span>Settings</span>
      </Link>
    </aside>
  );
}
