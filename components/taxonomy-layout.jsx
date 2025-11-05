import React from "react";
import Link from "next/link";
import ImageSafe, { characterAltText, Insignia } from "./image-safe";

export function TaxonomyIndexLayout({
  title,
  description,
  entries,
  basePath,
  badgeLabel = "LoreMaker Universe",
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050813] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(148,163,255,0.12),transparent_60%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" aria-hidden="true" />
      <main className="relative z-10 mx-auto max-w-7xl space-y-12 px-4 py-16 sm:px-6 lg:px-8">
        <header className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">{badgeLabel}</p>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="max-w-3xl text-lg font-semibold text-white/75">{description}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
            >
              ← Back to home
            </Link>
          </div>
        </header>
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <Link
              key={entry.slug}
              href={`${basePath}/${entry.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-6 transition hover:border-amber-300/60 hover:bg-amber-200/10 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                <span>{entry.memberCount} dossier{entry.memberCount === 1 ? "" : "s"}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{entry.type}</span>
              </div>
              <div className="mt-4 flex items-start gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-black/40 shadow-[0_12px_40px_rgba(8,10,26,0.55)]">
                  {entry.primaryImage ? (
                    <ImageSafe
                      src={entry.primaryImage}
                      alt={characterAltText(entry.name)}
                      fallbackLabel={entry.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/60">
                      <Insignia label={entry.name} size={44} />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <h2 className="text-2xl font-black text-white sm:text-3xl">{entry.name}</h2>
                  <p className="text-sm font-semibold text-white/70 line-clamp-3">{entry.summary}</p>
                </div>
              </div>
              {entry.snippets?.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm font-semibold text-white/60">
                  {entry.snippets.slice(0, 2).map((snippet, index) => (
                    <li key={index} className="line-clamp-2">
                      “{snippet}”
                    </li>
                  ))}
                </ul>
              )}
              <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                Explore dossier
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

export function TaxonomyDetailLayout({
  entry,
  basePath,
  typeLabel,
  typeLabelPlural,
  description,
  prefilterHref,
  relatedEntries = [],
}) {
  const plural = typeLabelPlural || `${typeLabel}s`;
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050813] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        {entry.primaryImage ? (
          <div className="absolute inset-0" aria-hidden="true">
            <ImageSafe
              src={entry.primaryImage}
              alt={characterAltText(entry.name)}
              fallbackLabel={entry.name}
              className="h-full w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-[#070b19]/70 to-[#050813]/80" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-black via-[#070b19] to-[#050813]" aria-hidden="true" />
        )}
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:px-8">
          <div className="flex-1 space-y-6">
            <Link
              href={basePath}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
            >
              ← Back to {plural}
            </Link>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">LoreMaker Universe · {typeLabel}</p>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{entry.name}</h1>
              <p className="max-w-2xl text-lg font-semibold text-white/80">{description || entry.summary}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                {entry.memberCount} dossier{entry.memberCount === 1 ? "" : "s"}
              </span>
              {prefilterHref && (
                <Link
                  href={prefilterHref}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/15 px-5 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/25"
                >
                  View filtered grid
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
      <main className="relative z-10 mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        {entry.snippets?.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-white">Lore threads</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entry.snippets.map((snippet, index) => (
                <blockquote
                  key={index}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-semibold text-white/75 backdrop-blur-xl"
                >
                  “{snippet}”
                </blockquote>
              ))}
            </div>
          </section>
        )}
        <section id="members" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-white">Featured dossiers</h2>
            <span className="text-sm font-semibold text-white/60">{entry.memberCount} connected legend{entry.memberCount === 1 ? "" : "s"}</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entry.members.map((member) => (
              <Link
                key={member.slug}
                href={`/characters/${member.slug}`}
                className="group overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 transition hover:border-amber-300/60 hover:bg-amber-200/10 backdrop-blur-xl"
              >
                <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  {member.cover ? (
                    <ImageSafe
                      src={member.cover}
                      alt={characterAltText(member.name)}
                      fallbackLabel={member.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/60">
                      <Insignia label={member.name} size={72} />
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-lg font-bold text-white">{member.name}</p>
                  {(member.alignment || member.status) && (
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                      {[member.alignment, member.status].filter(Boolean).join(" • ")}
                    </p>
                  )}
                  {member.shortDesc && <p className="text-sm font-semibold text-white/70 line-clamp-2">{member.shortDesc}</p>}
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                  View dossier
                </span>
              </Link>
            ))}
          </div>
        </section>
        {entry.metrics?.averageLevel && (
          <section className="rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="text-xl font-black text-white">Power metrics</h2>
            <p className="mt-2 text-sm font-semibold text-white/70">Average mastery across the known wielders of this ability.</p>
            <div className="mt-4 flex flex-wrap items-baseline gap-4">
              <div className="text-4xl font-black text-amber-200">{entry.metrics.averageLevel}</div>
              <div className="text-sm font-semibold text-white/60">Average rating out of 10</div>
            </div>
          </section>
        )}
        {relatedEntries.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-white">More {plural.toLowerCase()}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedEntries.map((item) => (
                <Link
                  key={item.slug}
                  href={`${basePath}/${item.slug}`}
                  className="group overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 transition hover:border-amber-300/60 hover:bg-amber-200/10 backdrop-blur-xl"
                >
                  <p className="text-lg font-bold text-white">{item.name}</p>
                  <p className="mt-2 text-sm font-semibold text-white/70 line-clamp-3">{item.summary}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                    Explore dossier
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
