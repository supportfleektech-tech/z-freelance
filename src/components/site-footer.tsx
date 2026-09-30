import Link from "next/link";
import { LogoMark } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="noise relative mt-16 overflow-hidden bg-brand-950 text-ink-100">
      <div aria-hidden className="aurora-blob -left-24 -top-24 h-72 w-72 bg-brand-500/25" />
      <div aria-hidden className="aurora-blob -bottom-24 right-0 h-72 w-72 bg-amber-400/15" />

      <div className="container-page relative grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-lg font-black tracking-tight text-white">
              z&#8209;freelance
            </span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-brand-100/80">
            The freelance marketplace where money moves through escrow. Clients fund milestones up
            front; freelancers get paid the moment work is approved.
          </p>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-700/80 bg-brand-900/60 px-3 py-1.5 text-xs font-semibold text-brand-100">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" aria-hidden />
            All systems escrow
          </p>
        </div>
        <FooterColumn
          title="Marketplace"
          links={[
            { href: "/projects", label: "Browse projects" },
            { href: "/freelancers", label: "Find freelancers" },
            { href: "/dashboard/messages", label: "Messages" },
          ]}
        />
        <FooterColumn
          title="Platform"
          links={[
            { href: "/docs", label: "How it works" },
            { href: "/docs/architecture", label: "Architecture" },
            { href: "/api/health", label: "Service status" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { href: "/register", label: "Create an account" },
            { href: "/login", label: "Sign in" },
          ]}
        />
      </div>

      <div className="relative border-t border-brand-800/70 py-5">
        <p className="container-page text-xs text-brand-200/70">
          © {new Date().getFullYear()} z-freelance · Payments are held in escrow and released on
          approval · 10% platform fee on released milestones
        </p>
      </div>
    </footer>
  );
}

function FooterColumn(props: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-brand-300">
        {props.title}
      </h3>
      <ul className="space-y-2.5">
        {props.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-brand-100/75 transition-all hover:pl-1 hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
