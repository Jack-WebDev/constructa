import { Link } from "@tanstack/react-router";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/builder", label: "Builder" },
    { to: "/generators", label: "Generators" },
    { to: "/quick-generate", label: "Quick Generate" },
  ] as const;

  return (
    <header className="border-b">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2"
      >
        {links.map(({ to, label }) => {
          return (
            <Link
              className="shrink-0 rounded px-3 py-2 font-medium text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              key={to}
              to={to}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
