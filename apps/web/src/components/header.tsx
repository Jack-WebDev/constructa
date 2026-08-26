import { Link } from "@tanstack/react-router";
import { Braces, Compass, Home, Sparkles, WandSparkles } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/builder", label: "Builder", icon: Braces },
  { to: "/generators", label: "Library", icon: Compass },
  { to: "/quick-generate", label: "Generate", icon: WandSparkles },
] as const;

export default function Header() {
  return (
    <>
      <header className="sticky top-0 z-40 border-border/80 border-b bg-background/90 backdrop-blur-xl">
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex h-18.5 max-w-7xl items-center justify-between px-4 sm:px-6"
        >
          <Link
            aria-label="Constructa home"
            className="group flex items-center gap-2.5 font-serif text-2xl tracking-[-0.045em]"
            to="/"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:-rotate-6">
              <Sparkles className="size-4" />
            </span>
            <span>constructa</span>
          </Link>
          <div className="hidden h-full items-center gap-6 md:flex">
            {links.map(({ to, label }) => {
              return (
                <Link
                  activeProps={{
                    className:
                      "text-primary after:scale-x-100 after:bg-primary",
                  }}
                  className="relative flex h-full items-center font-medium text-muted-foreground text-sm transition-colors after:absolute after:right-0 after:bottom-3.75 after:left-0 after:h-px after:scale-x-0 after:bg-primary after:transition-transform hover:text-foreground hover:after:scale-x-100"
                  key={to}
                  to={to}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <Link
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary-hover"
              to="/builder"
            >
              <span className="mr-2 text-lg leading-none">+</span> New generator
            </Link>
          </div>
        </nav>
      </header>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl md:hidden"
      >
        {links.map(({ to, label, icon: Icon }) => {
          return (
            <Link
              activeProps={{ className: "bg-secondary text-primary" }}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 font-medium text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              key={to}
              to={to}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
