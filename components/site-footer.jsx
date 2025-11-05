import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Atom,
  Crown,
  Library,
  MapPin,
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
      <div className="mx-auto max-w-7xl px-3 py-10 sm:px-4">
        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="text-xs font-black tracking-[0.35em] text-white/70">LoreMaker Universe</p>
            <p className="text-sm font-semibold tracking-[0.3em] text-white/70">© {currentYear} Menelek Makonnen.</p>
            <p className="text-sm font-semibold tracking-[0.3em] text-white/70">
              All characters, stories, lore, and artwork from the LoreMaker Universe are protected by copyright.
            </p>
          </div>
          <div className="space-y-4">
            <p className="text-xs font-black tracking-[0.35em] text-white/70">Explore</p>
            <div className="flex flex-col gap-2">
              <Link
                href={arenaHref}
                className={buttonClasses({
                  variant: "subtle",
                  className: "justify-start gap-2 text-xs tracking-[0.3em]",
                })}
              >
                <Swords className="h-4 w-4" aria-hidden="true" />
                Battle Arena
              </Link>
              {typeof onRandomCharacter === "function" && (
                <button
                  type="button"
                  onClick={handleRandom}
                  className={buttonClasses({
                    variant: "subtle",
                    className: "justify-start gap-2 text-xs tracking-[0.3em]",
                  })}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Random Character
                </button>
              )}
              <Link
                href="/#characters-grid"
                className={buttonClasses({
                  variant: "subtle",
                  className: "justify-start gap-2 text-xs tracking-[0.3em]",
                })}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Character Archive
              </Link>
              <Link
                href="/factions"
                className={buttonClasses({
                  variant: "subtle",
                  className: "justify-start gap-2 text-xs tracking-[0.3em]",
                })}
              >
                <Crown className="h-4 w-4" aria-hidden="true" />
                Factions Directory
              </Link>
              <Link
                href="/powers"
                className={buttonClasses({
                  variant: "subtle",
                  className: "justify-start gap-2 text-xs tracking-[0.3em]",
                })}
              >
                <Atom className="h-4 w-4" aria-hidden="true" />
                Power Index
              </Link>
              <Link
                href="/locations"
                className={buttonClasses({
                  variant: "subtle",
                  className: "justify-start gap-2 text-xs tracking-[0.3em]",
                })}
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                World Footprints
              </Link>
              <Link
                href="/timelines"
                className={buttonClasses({
                  variant: "subtle",
                  className: "justify-start gap-2 text-xs tracking-[0.3em]",
                })}
              >
                <Library className="h-4 w-4" aria-hidden="true" />
                Era Timelines
              </Link>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-xs font-black tracking-[0.35em] text-white/70">Connect</p>
            <div className="flex flex-col gap-2">
              <a
                href="https://menelekmakonnen.com"
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({
                  variant: "subtle",
                  className: "justify-start gap-2 text-xs tracking-[0.3em]",
                })}
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Menelek Makonnen
              </a>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={buttonClasses({
                  variant: "ghost",
                  className: "justify-start gap-2 text-xs tracking-[0.3em] text-white/70 hover:text-white",
                })}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
                Back to Top
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
