"use client";

/**
 * Integration example — how to add the ODM agent to your existing sidebar nav.
 *
 * This is a REFERENCE snippet, not wired into any protected layout. Copy the
 * <li> (or NavItem) into your real sidebar component. It does not modify your
 * existing navigation or design system.
 *
 * Route assumed: a page that renders <ProductAnalyzer /> at /tools/odm-agent
 * (create app/tools/odm-agent/page.tsx that imports ProductAnalyzer).
 */

import Link from "next/link";

export function OdmAgentNavItem({ pathname = "" }) {
  const href = "/tools/odm-agent";
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-emerald-500/15 text-emerald-300"
          : "text-gray-300 hover:bg-white/5"
      ].join(" ")}
    >
      <span aria-hidden>🎯</span>
      <span>Agente ODM</span>
    </Link>
  );
}

/* --- Usage inside your sidebar -------------------------------------------
import { OdmAgentNavItem } from "@/components/NavIntegrationExample";
// ...
<nav>
  <OdmAgentNavItem pathname={pathname} />
</nav>
-------------------------------------------------------------------------- */
