import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-200 bg-white">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-ink-500">
            The freelance marketplace where money moves through escrow. Clients fund milestones up
            front; freelancers get paid the moment work is approved.
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
            { href: "/docs", label: "Documentation" },
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
      <div className="border-t border-ink-100 py-4">
        <p className="container-page text-xs text-ink-400">
          © {new Date().getFullYear()} z-freelance · Payments are held in escrow and released on
          approval · 10% platform fee on released milestones
        </p>
      </div>
    </footer>
  );
}

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-ink-950">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        z
      </span>
      z&#8209;freelance
    </Link>
  );
}

function FooterColumn(props: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink-900">{props.title}</h3>
      <ul className="space-y-2">
        {props.links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-ink-500 hover:text-ink-900">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
