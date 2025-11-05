import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Atom,
  Crown,
  Library,
  MapPin,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";

function buttonClasses({
  variant = "subtle",
  size = "sm",
  className = "",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";
  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
  };
  const variants = {
    subtle: "border border-white/20 bg-white/10 text-white hover:bg-white/20",
    ghost: "text-white/80 hover:text-white",
    dark: "border border-white/20 bg-black/60 text-white hover:bg-black",
  };
  return [base, sizes[size] || sizes.sm, variants[variant] || variants.subtle, className]
    .filter(Boolean)
    .join(" ");
}

export default function SiteFooter({
  onRandomCharacter,
  arenaHref = "#arena-anchor",
}) {
  const currentYear = new Date().getFullYear();
  const handleRandom = () => {
    if (typeof onRandomCharacter === "function") {
      onRandomCharacter();
    }
  };

  return (
    <footer className="border-t border-white/10 bg-black/50 backdrop-blur-2xl">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="text-xs font-black tracking-[0.35em] text-white/70">LoreMaker Universe</p>
            <p className="text-sm font-semibold text-white/80">
              © {currentYear} Menelek Makonnen. All characters, stories, lore, and artwork from the LoreMaker Universe are
              protected by copyright.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-white/60">
              <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" />
              Crafted for dreamers, archivists, and cosmic tacticians.
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-xs font-black tracking-[0.35em] text-white/70">Navigate</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={arenaHref}
                className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
              >
                <Swords className="h-4 w-4" aria-hidden="true" />
                Battle Arena
              </Link>
              {typeof onRandomCharacter === "function" && (
                <button
                  type="button"
                  onClick={handleRandom}
                  className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
                >
                  <Shuffle aria-hidden="true" className="h-4 w-4" />
                  Surprise Me
                </button>
              )}
              <Link
                href="/#characters-grid"
                className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Characters
              </Link>
              <Link
                href="/factions"
                className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
              >
                <Crown className="h-4 w-4" aria-hidden="true" />
                Factions
              </Link>
              <Link
                href="/powers"
                className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
              >
                <Atom className="h-4 w-4" aria-hidden="true" />
                Powers
              </Link>
              <Link
                href="/locations"
                className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Locations
              </Link>
              <Link
                href="/timelines"
                className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
              >
                <Library className="h-4 w-4" aria-hidden="true" />
                Timelines
              </Link>
              <a
                href="https://menelekmakonnen.com"
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: "subtle", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Menelek Makonnen
              </a>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-white/60">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={buttonClasses({ variant: "ghost", className: "gap-2 text-[0.65rem] tracking-[0.25em]" })}
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            Back to top
          </button>
          <span className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-300" />
            Secure & SSL optimised
          </span>
        </div>
      </div>
    </footer>
  );
}
