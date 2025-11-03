import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import fallbackCharacters from "../../data/fallback-characters.json";
import {
  fetchCharactersFromSheets,
  fillDailyPowers,
  characterSlug,
  normaliseArray,
  seededRandom,
} from "../../lib/characters";

const DEFAULT_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://loremaker.app").replace(/\/$/, "");

function sanitizeCharacter(character) {
  if (!character) return null;
  const shaped = fillDailyPowers(character);
  const alias = normaliseArray(shaped.alias);
  const faction = normaliseArray(shaped.faction);
  const locations = normaliseArray(shaped.locations);
  const tags = normaliseArray(shaped.tags);
  const stories = normaliseArray(shaped.stories);
  const gallery = normaliseArray(shaped.gallery);
  const safe = {
    ...shaped,
    id: shaped.id || characterSlug(shaped) || null,
    slug: characterSlug(shaped),
    alias,
    faction,
    locations,
    tags,
    stories,
    gallery,
  };
  Object.keys(safe).forEach((key) => {
    if (safe[key] === undefined) safe[key] = null;
  });
  return safe;
}

function formatDescription(character) {
  const source = character.shortDesc || character.longDesc || "A legendary figure from the LoreMaker Universe.";
  return source.length > 180 ? `${source.slice(0, 177).trimEnd()}…` : source;
}

function buildSchema(character, canonicalUrl) {
  if (!character) return "";
  const alias = character.alias || [];
  const factions = character.faction || [];
  const locations = character.locations || [];
  const powers = (character.powers || []).map((power) => power?.name).filter(Boolean);
  const images = [character.cover, ...(character.gallery || [])].filter(Boolean);
  const attributes = [];
  if (character.status) {
    attributes.push({ "@type": "PropertyValue", name: "Status", value: character.status });
  }
  if (character.alignment) {
    attributes.push({ "@type": "PropertyValue", name: "Alignment", value: character.alignment });
  }
  if (character.era) {
    attributes.push({ "@type": "PropertyValue", name: "Era", value: character.era });
  }
  const schema = {
    "@context": "https://schema.org",
    "@type": "FictionalCharacter",
    name: character.name,
    alternateName: alias.length > 1 ? alias : alias[0],
    description: character.shortDesc || character.longDesc,
    url: canonicalUrl,
    image: images.length === 1 ? images[0] : images,
    knowsAbout: powers,
    workLocation: locations.map((loc) => ({ "@type": "Place", name: loc })),
    memberOf: factions.map((fac) => ({ "@type": "Organization", name: fac })),
    additionalType: "https://schema.org/Person",
    gender: character.gender || undefined,
    disambiguatingDescription: character.alias?.[0] || undefined,
    additionalProperty: attributes.length ? attributes : undefined,
  };

  return JSON.stringify(schema, (key, value) => {
    if (value == null) return undefined;
    if (Array.isArray(value) && !value.length) return undefined;
    if (typeof value === "object" && Object.keys(value).length === 0) return undefined;
    return value;
  });
}

function buildRelated(characters, currentId) {
  const pool = (characters || []).filter((char) => char && char.id && char.id !== currentId);
  if (!pool.length) return [];
  const rng = seededRandom(`related|${currentId}`);
  const scored = pool.map((char) => ({ char, score: rng() }));
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map(({ char }) => ({
      name: char.name,
      slug: characterSlug(char),
      shortDesc: char.shortDesc || char.longDesc || null,
      cover: char.cover || char.gallery?.[0] || null,
      status: char.status || null,
      alignment: char.alignment || null,
    }));
}

function GalleryCarousel({ images = [], name = "LoreMaker legend" }) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const length = safeImages.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const pointerRef = useRef({ id: null, startX: 0 });
  const lightboxPointerRef = useRef({ id: null, startX: 0 });

  useEffect(() => {
    if (!length) {
      setActiveIndex(0);
      setLightboxIndex(0);
      return;
    }
    setActiveIndex((value) => (value >= length ? length - 1 : value));
    setLightboxIndex((value) => (value >= length ? length - 1 : value));
  }, [length]);

  const goNext = useCallback(() => {
    if (!length) return;
    setActiveIndex((value) => {
      const next = (value + 1) % length;
      if (lightboxOpen) setLightboxIndex(next);
      return next;
    });
  }, [length, lightboxOpen]);

  const goPrev = useCallback(() => {
    if (!length) return;
    setActiveIndex((value) => {
      const next = (value - 1 + length) % length;
      if (lightboxOpen) setLightboxIndex(next);
      return next;
    });
  }, [length, lightboxOpen]);

  const openLightbox = useCallback(
    (index) => {
      if (!length) return;
      setLightboxIndex(index);
      setLightboxOpen(true);
    },
    [length]
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [lightboxOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!length) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Escape" && lightboxOpen) {
        event.preventDefault();
        closeLightbox();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [length, goNext, goPrev, lightboxOpen, closeLightbox]);

  useEffect(() => {
    if (lightboxOpen) {
      setLightboxIndex(activeIndex);
    }
  }, [lightboxOpen, activeIndex]);

  const handlePointerDown = useCallback((event) => {
    pointerRef.current = { id: event.pointerId, startX: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handlePointerUp = useCallback(
    (event) => {
      if (pointerRef.current.id !== event.pointerId) return;
      const delta = event.clientX - pointerRef.current.startX;
      if (Math.abs(delta) > 40) {
        if (delta < 0) {
          goNext();
        } else {
          goPrev();
        }
      } else {
        openLightbox(activeIndex);
      }
      pointerRef.current = { id: null, startX: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [goNext, goPrev, openLightbox, activeIndex]
  );

  const handlePointerCancel = useCallback(() => {
    pointerRef.current = { id: null, startX: 0 };
  }, []);

  const handleLightboxPointerDown = useCallback((event) => {
    lightboxPointerRef.current = { id: event.pointerId, startX: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleLightboxPointerUp = useCallback(
    (event) => {
      if (lightboxPointerRef.current.id !== event.pointerId) return;
      const delta = event.clientX - lightboxPointerRef.current.startX;
      if (Math.abs(delta) > 40) {
        if (delta < 0) {
          goNext();
        } else {
          goPrev();
        }
      }
      lightboxPointerRef.current = { id: null, startX: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [goNext, goPrev]
  );

  const handleLightboxPointerCancel = useCallback(() => {
    lightboxPointerRef.current = { id: null, startX: 0 };
  }, []);

  if (!length) {
    return (
      <div className="rounded-[32px] border border-white/15 bg-white/5 p-6 text-center text-sm font-semibold text-white/70">
        Visual dossier arriving soon.
      </div>
    );
  }

  const activeImage = safeImages[activeIndex] || null;
  const lightboxImage = safeImages[lightboxIndex] || null;

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox(activeIndex);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="group relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-[32px] border border-white/15 bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        {activeImage ? (
          <img
            src={activeImage}
            alt={`${name} dossier illustration ${activeIndex + 1}`}
            className="h-full w-full select-none object-cover"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-white/70">
            Imagery loading…
          </div>
        )}
        {length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/60 p-2 text-white transition hover:bg-black/80"
              aria-label="Show previous image"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/60 p-2 text-white transition hover:bg-black/80"
              aria-label="Show next image"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-12 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">
          <span>
            {activeIndex + 1} / {length}
          </span>
          <span className="hidden items-center gap-2 text-xs font-semibold text-white/70 sm:flex">
            <Maximize2 className="h-4 w-4" aria-hidden="true" /> Tap to expand
          </span>
        </div>
      </div>
      {length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {safeImages.map((image, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  if (lightboxOpen) setLightboxIndex(index);
                }}
                className={`relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border ${
                  active
                    ? "border-amber-300/80 ring-2 ring-amber-200/50"
                    : "border-white/15 hover:border-white/40"
                }`}
                aria-label={`Show image ${index + 1}`}
              >
                <img
                  src={image}
                  alt={`${name} thumbnail ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading={index < 4 ? "eager" : "lazy"}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  draggable={false}
                />
                {active && <span className="absolute inset-0 border-2 border-amber-200/60" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
      {lightboxOpen && lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">{name}</div>
            <div className="flex items-center gap-3 text-xs font-semibold text-white/80">
              <span>
                {lightboxIndex + 1} / {length}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeLightbox();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/60 px-3 py-1.5 text-white transition hover:bg-black/80"
              >
                <X className="h-4 w-4" aria-hidden="true" /> Close
              </button>
            </div>
          </div>
          <div
            className="relative flex flex-1 items-center justify-center px-6 pb-10"
            onClick={(event) => event.stopPropagation()}
          >
            {length > 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goPrev();
                }}
                className="absolute left-10 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/60 p-3 text-white transition hover:bg-black/80"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
            <div
              className="max-h-full w-full max-w-4xl"
              onPointerDown={handleLightboxPointerDown}
              onPointerUp={handleLightboxPointerUp}
              onPointerCancel={handleLightboxPointerCancel}
            >
              <img
                src={lightboxImage}
                alt={`${name} gallery image ${lightboxIndex + 1}`}
                className="max-h-[75vh] w-full select-none rounded-[28px] object-contain"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                draggable={false}
              />
            </div>
            {length > 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goNext();
                }}
                className="absolute right-10 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/60 p-3 text-white transition hover:bg-black/80"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CharacterProfilePage({ character, canonicalUrl, related, schemaJson }) {
  if (!character) {
    return null;
  }
  const metaDescription = formatDescription(character);
  const heroImage = character.cover || character.gallery?.[0] || null;
  const galleryImages = useMemo(() => {
    const pool = [character.cover, ...(character.gallery || [])].filter(Boolean);
    if (pool.length) {
      return Array.from(new Set(pool));
    }
    return heroImage ? [heroImage] : [];
  }, [character.cover, character.gallery, heroImage]);
  const alias = character.alias || [];
  const locations = character.locations || [];
  const factions = character.faction || [];
  const stories = character.stories || [];
  const tags = character.tags || [];
  const powers = character.powers || [];

  return (
    <>
      <Head>
        <title>{`${character.name} | LoreMaker Universe Codex`}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${character.name} | LoreMaker Universe Codex`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        {heroImage && <meta property="og:image" content={heroImage} />}
        <meta property="og:site_name" content="LoreMaker Universe" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${character.name} | LoreMaker Universe Codex`} />
        <meta name="twitter:description" content={metaDescription} />
        {heroImage && <meta name="twitter:image" content={heroImage} />}
        {schemaJson && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaJson }} />}
      </Head>
      <div className="min-h-screen bg-[#050813] text-white">
        <div className="relative overflow-hidden border-b border-white/10 bg-black/40">
          {heroImage && (
            <div className="absolute inset-0">
              <img
                src={heroImage}
                alt={`${character.name} portrait from the LoreMaker Universe`}
                className="h-full w-full object-cover object-[68%_center]"
                loading="eager"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#050813] via-[#050813]/80 to-[#050813]/40" />
            </div>
          )}
          <header className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 lg:flex-row lg:items-end lg:gap-16">
            <div className="flex-1 space-y-6">
              <nav className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                <Link href="/" className="hover:text-white/90">
                  Loremaker Universe
                </Link>
                <span className="mx-3 text-white/40">/</span>
                <span className="text-white/90">Codex</span>
              </nav>
              <div className="space-y-3">
                <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  {character.name}
                </h1>
                {alias.length > 0 && (
                  <p className="text-lg font-semibold text-white/75">Also known as {alias.join(", ")}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                {character.alignment && <span className="rounded-full bg-white/10 px-4 py-1">{character.alignment}</span>}
                {character.status && <span className="rounded-full bg-white/10 px-4 py-1">{character.status}</span>}
                {character.era && <span className="rounded-full bg-white/10 px-4 py-1">Era: {character.era}</span>}
              </div>
              <p className="max-w-2xl text-base font-semibold text-white/80 lg:text-lg">{metaDescription}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/#characters-grid"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
                >
                  ← Back to archive
                </Link>
                <Link
                  href="/#arena"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/20 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/30"
                >
                  Challenge in the arena
                </Link>
              </div>
            </div>
          </header>
        </div>
        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <article className="space-y-16">
            {!!galleryImages.length && (
              <section>
                <GalleryCarousel images={galleryImages} name={character.name} />
              </section>
            )}
            <section className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
              <div className="space-y-10">
                <div>
                  <h2 className="text-2xl font-black text-white">Lore overview</h2>
                  <p className="mt-4 text-base leading-relaxed text-white/80">
                    {character.longDesc || character.shortDesc || "More dossiers arriving soon."}
                  </p>
                </div>
                {!!stories.length && (
                  <div>
                    <h2 className="text-2xl font-black text-white">Key appearances</h2>
                    <ul className="mt-4 list-disc space-y-2 pl-6 text-white/80">
                      {stories.map((story) => (
                        <li key={story} className="text-sm font-semibold sm:text-base">
                          {story}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!tags.length && (
                  <div>
                    <h2 className="text-2xl font-black text-white">Traits &amp; themes</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <aside className="space-y-6 rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-xl font-black text-white">Profile dossier</h2>
                <dl className="space-y-3 text-sm text-white/80">
                  {locations.length > 0 && (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.25em] text-white/60">Strongholds</dt>
                      <dd className="mt-1 font-semibold">{locations.join(", ")}</dd>
                    </div>
                  )}
                  {factions.length > 0 && (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.25em] text-white/60">Alliances</dt>
                      <dd className="mt-1 font-semibold">{factions.join(", ")}</dd>
                    </div>
                  )}
                  {character.firstAppearance && (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.25em] text-white/60">First appearance</dt>
                      <dd className="mt-1 font-semibold">{character.firstAppearance}</dd>
                    </div>
                  )}
                  {character.gender && (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.25em] text-white/60">Identity</dt>
                      <dd className="mt-1 font-semibold">{character.gender}</dd>
                    </div>
                  )}
                  {!!alias.length && (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.25em] text-white/60">Aliases</dt>
                      <dd className="mt-1 font-semibold">{alias.join(", ")}</dd>
                    </div>
                  )}
                </dl>
                {!!powers.length && (
                  <div>
                    <h3 className="text-lg font-black text-white">Top powers</h3>
                    <ul className="mt-3 space-y-2">
                      {powers.map((power) => (
                        <li key={power.name} className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
                          <span className="text-sm font-semibold text-white/85">{power.name}</span>
                          <span className="text-xs font-bold text-amber-200">{power.level}/10</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            </section>

            {!!related.length && (
              <section>
                <h2 className="text-2xl font-black text-white">Explore more legends</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {related.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/characters/${item.slug}`}
                      className="group flex flex-col justify-between rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur-xl transition hover:border-amber-300/60 hover:bg-white/10"
                    >
                      <div className="space-y-3">
                        <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                          {item.cover ? (
                            <img
                              src={item.cover}
                              alt={`${item.name} portrait from the LoreMaker Universe`}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              decoding="async"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm font-bold text-white/60">No imagery yet</div>
                          )}
                        </div>
                        <h3 className="text-xl font-black text-white">{item.name}</h3>
                        {item.shortDesc && <p className="text-sm font-semibold text-white/70">{item.shortDesc}</p>}
                      </div>
                      <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                        View dossier →
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
        </main>
      </div>
    </>
  );
}

async function loadCharacters() {
  try {
    const fetched = await fetchCharactersFromSheets();
    if (Array.isArray(fetched) && fetched.length) {
      return fetched.map((character) => sanitizeCharacter(character));
    }
  } catch (error) {
    console.warn("[character-profile] Falling back to bundled characters", error);
  }
  return fallbackCharacters
    .map((character, index) => {
      const entry = sanitizeCharacter(character);
      if (entry && typeof entry.sourceIndex !== "number") {
        entry.sourceIndex = index;
      }
      return entry;
    })
    .filter(Boolean);
}

export async function getStaticPaths() {
  const characters = await loadCharacters();
  const paths = characters
    .map((character) => ({ params: { slug: characterSlug(character) } }))
    .filter((entry) => entry.params.slug);

  return {
    paths,
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const characters = await loadCharacters();
  const slug = params?.slug;
  const character = characters.find((entry) => characterSlug(entry) === slug);

  if (!character) {
    return { notFound: true, revalidate: 300 };
  }

  const canonicalUrl = `${DEFAULT_SITE_URL}/characters/${characterSlug(character)}`;
  const related = buildRelated(characters, character.id);
  const schemaJson = buildSchema(character, canonicalUrl);

  return {
    props: {
      character,
      canonicalUrl,
      related,
      schemaJson,
    },
    revalidate: 600,
  };
}
