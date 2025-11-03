import React, { useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  fetchCharactersFromSheets,
  publicCharactersError,
  fillDailyPowers,
  normaliseArray,
} from "../../lib/characters";
import fallbackCharacters from "../../data/fallback-characters.json";

function slugifyId(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function clean(value) {
  if (Array.isArray(value)) {
    const filtered = value
      .map((item) => clean(item))
      .filter((item) => item != null && (typeof item !== "object" || Object.keys(item).length > 0));
    return filtered.length ? filtered : undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, val]) => [key, clean(val)])
      .filter(([, val]) => val !== undefined && val !== null);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function powerIntensityLabel(level) {
  if (!Number.isFinite(level)) return "Developing";
  if (level >= 9) return "Mythic";
  if (level >= 7) return "Legendary";
  if (level >= 5) return "Elite";
  if (level >= 3) return "Trained";
  return "Emerging";
}

function CharacterProfilePage({ character, siteUrl }) {
  if (!character) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050813] p-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/15 bg-black/60 p-8 text-center">
          <h1 className="text-3xl font-black">Character dossier unavailable</h1>
          <p className="mt-3 text-base text-white/70">
            The requested LoreMaker profile could not be located. Return to the codex to explore the living universe.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 font-bold text-black transition hover:bg-white/90"
            >
              Back to Codex
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const aliases = normaliseArray(character.alias);
  const factions = normaliseArray(character.faction);
  const locations = normaliseArray(character.locations);
  const stories = normaliseArray(character.stories);
  const tags = normaliseArray(character.tags);
  const abilities = Array.isArray(character.powers) ? character.powers : [];
  const image = character.cover || character.gallery?.[0] || null;
  const canonicalUrl = `${siteUrl}/characters/${character.id || slugifyId(character.name)}`;
  const description = character.longDesc || character.shortDesc || `${character.name} profile from the LoreMaker Universe.`;

  const schemaJson = useMemo(() => {
    const payload = clean({
      "@context": "https://schema.org",
      "@type": "FictionalCharacter",
      name: character.name,
      alternateName: aliases.length > 1 ? aliases : aliases[0],
      description,
      url: canonicalUrl,
      mainEntityOfPage: canonicalUrl,
      image,
      creator: {
        "@type": "Person",
        name: "Menelek Makonnen",
        url: "https://menelekmakonnen.com",
      },
      memberOf: factions.map((name) => ({ "@type": "Organization", name })),
      workLocation: locations.map((name) => ({ "@type": "Place", name })),
      subjectOf: stories.map((name) => ({ "@type": "CreativeWork", name })),
      genre: ["Superhero", "Fantasy", "Speculative fiction"],
      hasAbility: abilities.map((power) =>
        clean({
          "@type": "DefinedTerm",
          name: power?.name,
          description: power?.name ? `${power.name} rated ${power.level ?? "unknown"}/10` : undefined,
        })
      ),
      additionalProperty: clean({
        "@type": "PropertyValue",
        name: "Status",
        value: character.status,
      }),
    });
    return JSON.stringify(payload ?? {});
  }, [abilities, aliases, canonicalUrl, character.name, character.status, description, factions, image, locations, stories]);

  const metaTitle = `${character.name} | LoreMaker Universe: Superheroes & Fantasy Characters Codex`;
  const metaDescription = description.slice(0, 220);

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        {image && <meta property="og:image" content={image} />}
        <meta property="og:site_name" content="LoreMaker Universe" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        {image && <meta name="twitter:image" content={image} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaJson }} />
      </Head>
      <main className="min-h-screen bg-[#050813] pb-16 text-white">
        <header className="relative overflow-hidden border-b border-white/10 bg-black/40">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-amber-500/10 to-transparent" />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-20 lg:flex-row">
            <div className="flex-1 space-y-5">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-white/70">LoreMaker Profile</p>
              <h1 className="text-4xl font-black leading-tight text-balance sm:text-5xl lg:text-6xl">{character.name}</h1>
              {aliases.length > 0 && (
                <p className="text-sm font-semibold text-white/70">Also known as: {aliases.join(", ")}</p>
              )}
              <p className="max-w-2xl text-base font-semibold text-white/80 sm:text-lg">{description}</p>
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-white/70 sm:text-sm">
                {character.alignment && (
                  <span className="rounded-full border border-white/20 px-4 py-1">Alignment: {character.alignment}</span>
                )}
                {character.status && (
                  <span className="rounded-full border border-white/20 px-4 py-1">Status: {character.status}</span>
                )}
                {character.era && <span className="rounded-full border border-white/20 px-4 py-1">Era: {character.era}</span>}
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/90"
                >
                  ← Back to Codex
                </Link>
                <Link
                  href="/#characters-grid"
                  className="inline-flex items-center rounded-full border border-white/30 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Browse all heroes
                </Link>
              </div>
            </div>
            <figure className="flex w-full max-w-md flex-col gap-4 self-end">
              {image ? (
                <img
                  src={image}
                  alt={`${character.name} portrait from the LoreMaker Universe`}
                  className="h-72 w-full rounded-3xl border border-white/15 object-cover shadow-[0_18px_60px_rgba(15,18,45,0.6)]"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  decoding="async"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/10 text-lg font-black text-white/70">
                  Classified imagery pending
                </div>
              )}
              <figcaption className="text-sm text-white/70">
                {character.firstAppearance
                  ? `First documented in ${character.firstAppearance}.`
                  : "Primary codex portrait."}
              </figcaption>
            </figure>
          </div>
        </header>

        <div className="mx-auto mt-12 grid max-w-6xl gap-10 px-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-black text-white">Origin Story</h2>
            <p className="mt-4 whitespace-pre-wrap text-base font-semibold leading-relaxed text-white/80">
              {character.longDesc ||
                `The chronicles of ${character.name} are still being recorded. Check back soon for a fully transcribed biography.`}
            </p>
            {tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/20 px-3 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-black text-white">Powers &amp; Abilities</h2>
            {abilities.length ? (
              <ul className="mt-6 space-y-4">
                {abilities.map((power) => (
                  <li
                    key={power?.name || power?.level}
                    className="rounded-2xl border border-white/15 bg-black/40 p-4 shadow-[0_12px_40px_rgba(8,10,30,0.35)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-lg font-extrabold text-white">{power?.name || "Unnamed ability"}</span>
                      {Number.isFinite(power?.level) && (
                        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white/80">
                          {power.level}/10 · {powerIntensityLabel(Number(power.level))}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-white/75">
                      {power?.name
                        ? `${character.name} wields ${power.name} at a ${powerIntensityLabel(Number(power.level))} intensity, allowing them to shift the course of conflicts across the LoreMaker Universe.`
                        : "This capability has yet to be fully catalogued."}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-base text-white/70">
                The Loremaker archivists are still decoding the abilities attributed to {character.name}.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-black text-white">Alliances &amp; Territories</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/60">Factions</h3>
                <ul className="mt-3 space-y-2 text-base text-white/80">
                  {factions.length ? factions.map((name) => <li key={name}>{name}</li>) : <li>No formal allegiance recorded.</li>}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/60">Strongholds</h3>
                <ul className="mt-3 space-y-2 text-base text-white/80">
                  {locations.length ? locations.map((name) => <li key={name}>{name}</li>) : <li>Operates across undisclosed realms.</li>}
                </ul>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm font-semibold text-white/75 md:grid-cols-2">
              {character.firstAppearance && (
                <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/60">First appearance</p>
                  <p className="mt-2 text-white">{character.firstAppearance}</p>
                </div>
              )}
              {character.status && (
                <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/60">Current status</p>
                  <p className="mt-2 text-white">{character.status}</p>
                </div>
              )}
              {character.era && (
                <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/60">Era</p>
                  <p className="mt-2 text-white">{character.era}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-black text-white">Key Appearances</h2>
            {stories.length ? (
              <ol className="mt-6 list-decimal space-y-2 pl-6 text-base text-white/80">
                {stories.map((story) => (
                  <li key={story}>{story}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-base text-white/70">
                Records of {character.name}'s defining appearances are still being chronicled within the Codex.
              </p>
            )}
          </section>

          {character.gallery && character.gallery.length > 0 && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <h2 className="text-2xl font-black text-white">Visual Archive</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[character.cover, ...character.gallery]
                  .filter(Boolean)
                  .map((src, index) => (
                    <img
                      key={`${src}-${index}`}
                      src={src}
                      alt={`${character.name} LoreMaker artwork ${index + 1}`}
                      className="h-48 w-full rounded-2xl border border-white/15 object-cover shadow-[0_12px_40px_rgba(10,12,32,0.4)]"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      decoding="async"
                      loading="lazy"
                    />
                  ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export default CharacterProfilePage;

function processFallbackCharacters() {
  return fallbackCharacters.map((char) => fillDailyPowers(char));
}

export async function getStaticPaths() {
  try {
    const characters = await fetchCharactersFromSheets();
    const paths = (characters || [])
      .map((char) => char && (char.id || slugifyId(char.name)))
      .filter(Boolean)
      .map((id) => ({ params: { id } }));
    if (paths.length) {
      return { paths, fallback: "blocking" };
    }
  } catch (error) {
    console.warn("[characters] Falling back to static profiles", publicCharactersError(error));
  }

  const fallbackPaths = processFallbackCharacters()
    .map((char) => char && (char.id || slugifyId(char.name)))
    .filter(Boolean)
    .map((id) => ({ params: { id } }));

  return { paths: fallbackPaths, fallback: "blocking" };
}

export async function getStaticProps({ params }) {
  const { id } = params || {};
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://loremaker.app").replace(/\/$/, "");

  const loadCharacters = async () => {
    try {
      const characters = await fetchCharactersFromSheets();
      if (characters?.length) return characters;
    } catch (error) {
      console.error("[characters] Failed to hydrate profile", error);
    }
    return processFallbackCharacters();
  };

  const characters = await loadCharacters();
  const character = characters.find((char) => (char.id || slugifyId(char.name)) === id) || null;

  if (!character) {
    return { notFound: true, revalidate: 300 };
  }

  return {
    props: {
      character,
      siteUrl,
    },
    revalidate: 600,
  };
}

