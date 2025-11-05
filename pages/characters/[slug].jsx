import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Head from "next/head";
import Link from "next/link";
import {
  Atom,
  ChevronLeft,
  ChevronRight,
  Crown,
  MapPin,
  Maximize2,
  Sparkles,
  Swords,
  X,
  ArrowUpRight,
} from "lucide-react";
import fallbackCharacters from "../../data/fallback-characters.json";
import {
  fetchCharactersFromSheets,
  fillDailyPowers,
  characterSlug,
  normaliseArray,
  ensureUniqueSlugs,
  seededRandom,
} from "../../lib/characters";
import ImageSafe, { characterAltText, imageCandidates } from "../../components/image-safe";
import SiteFooter from "../../components/site-footer";
import ScrollShortcuts from "../../components/scroll-shortcuts";

const DEFAULT_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://loremaker.app").replace(/\/$/, "");

function safeReleasePointerCapture(target, pointerId) {
  if (!target || typeof pointerId !== "number") return;
  const release = target?.releasePointerCapture;
  if (typeof release !== "function") return;
  if (typeof target.hasPointerCapture === "function" && !target.hasPointerCapture(pointerId)) {
    return;
  }
  try {
    release.call(target, pointerId);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Pointer capture release failed", error);
    }
  }
}

function sanitizeCharacter(character) {
  if (!character) return null;
  const shaped = fillDailyPowers(character);
  const alias = normaliseArray(shaped.alias);
  const faction = normaliseArray(shaped.faction);
  const locations = normaliseArray(shaped.locations);
  const tags = normaliseArray(shaped.tags);
  const eraTags = normaliseArray(shaped.eraTags || shaped.eras);
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
    eraTags,
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
  if (character.eraTags?.length) {
    attributes.push({ "@type": "PropertyValue", name: "Era timeline", value: character.eraTags.join(", ") });
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

function uniqueBySlug(characters) {
  const seen = new Set();
  const result = [];
  for (const entry of characters) {
    const slug = characterSlug(entry);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    result.push(entry);
  }
  return result;
}

function buildConnections(characters, current) {
  if (!current) {
    return { factions: [], locations: [], powers: [] };
  }
  const others = (characters || []).filter((entry) => entry && entry.id && entry.id !== current.id);
  const limit = 8;

  const hydrate = (list) =>
    list.map((entry) => ({
      name: entry.name,
      slug: characterSlug(entry),
      cover: entry.cover || entry.gallery?.[0] || null,
      alignment: entry.alignment || null,
      status: entry.status || null,
    }));

  const fromValues = (values, predicate) =>
    (values || [])
      .filter(Boolean)
      .map((value) => {
        const matches = uniqueBySlug(
          others.filter((entry) => predicate(entry, value))
        ).slice(0, limit);
        if (!matches.length) return null;
        return {
          label: value,
          characters: hydrate(matches),
        };
      })
      .filter(Boolean);

  const powerNames = (current.powers || []).map((power) => power?.name).filter(Boolean);

  return {
    factions: fromValues(current.faction || [], (entry, faction) => (entry.faction || []).includes(faction)),
    locations: fromValues(current.locations || [], (entry, location) => (entry.locations || []).includes(location)),
    powers: fromValues(powerNames, (entry, power) => (entry.powers || []).some((p) => p?.name === power)),
  };
}

function GalleryCarousel({ images = [], name = "LoreMaker legend", onActiveChange }) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const length = safeImages.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const pointerRef = useRef({ id: null, startX: 0, startY: 0, lastX: 0, moved: false, container: null, origin: null });
  const lightboxPointerRef = useRef({ id: null, startX: 0, startY: 0, lastX: 0, moved: false, container: null, origin: null });
  const altText = useMemo(() => `${name} | Loremaker Universe | Menelek Makonnen`, [name]);
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

  useEffect(() => {
    if (typeof onActiveChange !== "function") return;
    const current = safeImages[activeIndex] || safeImages[0] || null;
    onActiveChange(current);
  }, [activeIndex, safeImages, onActiveChange]);

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
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target?.closest?.('[data-gallery-control]')) return;
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      moved: false,
      container: event.currentTarget,
      origin: event.target,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      const current = pointerRef.current;
      if (!current || current.id !== event.pointerId) return;
      const deltaX = event.clientX - current.lastX;
      const totalX = event.clientX - current.startX;
      const totalY = event.clientY - current.startY;
      if (Math.abs(totalX) > Math.abs(totalY) && Math.abs(deltaX) > 24) {
        pointerRef.current = {
          ...current,
          lastX: event.clientX,
          moved: true,
        };
        if (deltaX < 0) {
          goNext();
        } else {
          goPrev();
        }
      }
    },
    [goNext, goPrev]
  );

  const handlePointerUp = useCallback(
    (event) => {
      const current = pointerRef.current;
      if (!current || current.id !== event.pointerId) return;
      const totalX = event.clientX - current.startX;
      const totalY = event.clientY - current.startY;
      const swiped = Math.abs(totalX) > 40 && Math.abs(totalX) > Math.abs(totalY);
      safeReleasePointerCapture(current.container, event.pointerId);
      pointerRef.current = { id: null, startX: 0, startY: 0, lastX: 0, moved: false, container: null, origin: null };
      if (current.origin?.closest?.('[data-gallery-control]')) {
        return;
      }
      if (!swiped && !current.moved) {
        openLightbox(activeIndex);
      }
    },
    [openLightbox, activeIndex]
  );

  const handlePointerCancel = useCallback(() => {
    const current = pointerRef.current;
    safeReleasePointerCapture(current.container, current.id);
    pointerRef.current = { id: null, startX: 0, startY: 0, lastX: 0, moved: false, container: null, origin: null };
  }, []);

  const handleLightboxPointerDown = useCallback((event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target?.closest?.('[data-gallery-control]')) return;
    lightboxPointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      moved: false,
      container: event.currentTarget,
      origin: event.target,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleLightboxPointerMove = useCallback(
    (event) => {
      const current = lightboxPointerRef.current;
      if (!current || current.id !== event.pointerId) return;
      const deltaX = event.clientX - current.lastX;
      const totalX = event.clientX - current.startX;
      const totalY = event.clientY - current.startY;
      if (Math.abs(totalX) > Math.abs(totalY) && Math.abs(deltaX) > 24) {
        lightboxPointerRef.current = {
          ...current,
          lastX: event.clientX,
          moved: true,
        };
        if (deltaX < 0) {
          goNext();
        } else {
          goPrev();
        }
      }
    },
    [goNext, goPrev]
  );

  const handleLightboxPointerUp = useCallback((event) => {
    const current = lightboxPointerRef.current;
    if (!current || current.id !== event.pointerId) return;
    safeReleasePointerCapture(current.container, event.pointerId);
    lightboxPointerRef.current = { id: null, startX: 0, startY: 0, lastX: 0, moved: false, container: null, origin: null };
  }, []);

  const handleLightboxPointerCancel = useCallback(() => {
    const current = lightboxPointerRef.current;
    safeReleasePointerCapture(current.container, current.id);
    lightboxPointerRef.current = { id: null, startX: 0, startY: 0, lastX: 0, moved: false, container: null, origin: null };
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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="group relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-[32px] border border-white/15 bg-black/50 touch-pan-y focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        {activeImage ? (
          <ImageSafe
            src={activeImage}
            alt={altText}
            fallbackLabel={name}
            className="h-full w-full select-none object-cover"
            loading="eager"
            decoding="async"
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
              data-gallery-control
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
              data-gallery-control
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-12 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
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
                data-gallery-control
              >
                <ImageSafe
                  src={image}
                  alt={altText}
                  fallbackLabel={name}
                  className="h-full w-full object-cover"
                  loading={index < 4 ? "eager" : "lazy"}
                  decoding="async"
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
              data-gallery-control
            >
                <X className="h-4 w-4" aria-hidden="true" /> Close
              </button>
            </div>
          </div>
          <div
            className="relative flex flex-1 items-center justify-center px-6 pb-6"
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
                data-gallery-control
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
            <div
              className="max-h-full w-full max-w-4xl touch-pan-y"
              onPointerDown={handleLightboxPointerDown}
              onPointerMove={handleLightboxPointerMove}
              onPointerUp={handleLightboxPointerUp}
              onPointerCancel={handleLightboxPointerCancel}
            >
              <ImageSafe
                src={lightboxImage}
                alt={altText}
                fallbackLabel={name}
                className="max-h-[75vh] w-full select-none rounded-[28px] object-contain"
                loading="eager"
                decoding="async"
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
                data-gallery-control
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
          </div>
          {length > 1 && (
            <div className="w-full max-w-5xl self-center overflow-x-auto px-6 pb-8 [scrollbar-width:thin]">
              <div className="flex gap-3">
                {safeImages.map((image, index) => {
                  const active = index === lightboxIndex;
                  return (
                    <button
                      key={`${image}-lightbox-${index}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLightboxIndex(index);
                        setActiveIndex(index);
                      }}
                      className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border ${
                        active
                          ? "border-amber-300/80 ring-2 ring-amber-200/60"
                          : "border-white/15 hover:border-white/40"
                      }`}
                      aria-label={`View image ${index + 1}`}
                      data-gallery-control
                    >
                      <ImageSafe
                        src={image}
                        alt={altText}
                        fallbackLabel={name}
                        className="h-full w-full object-cover"
                        loading={index < 6 ? "eager" : "lazy"}
                        decoding="async"
                        draggable={false}
                      />
                      {active && <span className="absolute inset-0 border-2 border-amber-200/60" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CharacterProfilePage({ character, canonicalUrl, related, schemaJson, connections }) {
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
  const [heroBackdrop, setHeroBackdrop] = useState(() => {
    if (!heroImage) return null;
    return imageCandidates(heroImage)[0] || heroImage;
  });

  useEffect(() => {
    if (!heroImage) {
      setHeroBackdrop(null);
      return;
    }
    setHeroBackdrop(imageCandidates(heroImage)[0] || heroImage);
  }, [heroImage]);

  const updateHeroBackdrop = useCallback((nextImage) => {
    if (!nextImage) return;
    setHeroBackdrop(imageCandidates(nextImage)[0] || nextImage);
  }, []);
  const filterHref = (key, value) => {
    if (!key || !value) return "/#characters-grid";
    return `/?prefilter=${encodeURIComponent(key)}:${encodeURIComponent(value)}#characters-grid`;
  };
  const highlightFacts = [
    character.identity && { label: "Identity", value: character.identity, key: "identity" },
    character.alignment && { label: "Alignment", value: character.alignment, key: "alignment" },
    character.status && { label: "Status", value: character.status, key: "status" },
    character.era && { label: "Era", value: character.era, key: "era" },
  ].filter(Boolean);
  const dossierEntries = [
    locations.length && { label: "Home bases", key: "locations", values: locations },
    factions.length && { label: "Allied groups", key: "faction", values: factions },
    character.identity && { label: "Identity", key: "identity", values: [character.identity] },
    character.gender && { label: "Gender", key: "gender", values: [character.gender], single: true },
    character.alignment && { label: "Alignment", key: "alignment", values: [character.alignment], single: true },
    character.status && { label: "Status", key: "status", values: [character.status] },
    character.firstAppearance && { label: "First seen", values: [character.firstAppearance] },
    alias.length && { label: "Also known as", key: "alias", values: alias },
  ].filter(Boolean);
  const storyParagraphs = useMemo(() => {
    const source = character.longDesc || character.shortDesc || "";
    const segments = source
      .split(/\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (!segments.length) {
      return ["More dossiers arriving soon."];
    }
    return segments;
  }, [character.longDesc, character.shortDesc]);
  const safeConnections = connections || { factions: [], locations: [], powers: [] };
  const allyGroups = safeConnections.factions || [];
  const connectionSections = [
    { title: "World footprint", icon: MapPin, groups: safeConnections.locations || [] },
    { title: "Power constellation", icon: Atom, groups: safeConnections.powers || [] },
  ].filter((section) => section.groups && section.groups.length);
  const navSections = useMemo(() => {
    const sections = [
      { id: "story", label: "Story" },
      { id: "identity", label: "Identity" },
    ];
    if (allyGroups.length) sections.push({ id: "allies", label: "Allies" });
    if (tags.length) sections.push({ id: "motifs", label: "Motifs" });
    if (powers.length) sections.push({ id: "powers", label: "Powers" });
    if (stories.length) sections.push({ id: "appearances", label: "Appearances" });
    if ((character.eraTags || []).length) sections.push({ id: "timelines", label: "Timelines" });
    if (connectionSections.length) sections.push({ id: "connections", label: "Connections" });
    if (related.length) sections.push({ id: "related", label: "More legends", shortLabel: "More" });
    return sections;
  }, [allyGroups.length, tags.length, powers.length, stories.length, character.eraTags, connectionSections.length, related.length]);
  const fallbackPool = useMemo(
    () =>
      fallbackCharacters
        .map((entry) => ({ slug: characterSlug(entry), name: entry.name }))
        .filter((entry) => entry.slug),
    []
  );
  const handleRandomCharacter = useCallback(() => {
    if (!fallbackPool.length) return;
    const random = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    if (!random?.slug) return;
    if (typeof window !== "undefined") {
      window.location.href = `/characters/${random.slug}`;
    }
  }, [fallbackPool]);

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
        <section className="relative isolate overflow-hidden border-b border-white/10">
          <div className="absolute inset-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={heroBackdrop || "blank"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#040617] via-[#050813] to-[#0d122d]" />
                {heroBackdrop && (
                  <>
                    <ImageSafe
                      src={heroBackdrop}
                      alt={characterAltText(character.name)}
                      fallbackLabel={character.name}
                      className="absolute inset-0 h-full w-full scale-110 object-cover object-[65%_center] blur-[16px] opacity-80"
                      loading="eager"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050813] via-[#050813]/82 to-[#050813]/30" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(253,230,138,0.24),transparent_55%)]" />
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:px-8">
            <nav className="mb-10 flex w-full max-w-5xl items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-white transition hover:text-amber-200"
                prefetch={false}
              >
                ← Back to all characters
              </Link>
              <span className="inline-block h-1 w-1 rounded-full bg-white/50" aria-hidden="true" />
              <span className="text-white/80">Character dossier</span>
            </nav>
            <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-end">
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white/75">
                    <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" />
                    Featured legend
                  </span>
                  <h1 className="text-4xl font-black leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
                    {character.name}
                  </h1>
                  {alias.length > 0 && (
                    <p className="text-lg font-semibold text-white/75">Also known as {alias.join(", ")}</p>
                  )}
                </div>
                {highlightFacts.length > 0 && (
                  <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
                {highlightFacts.map((fact) => {
                  const label = `${fact.label}: ${fact.value}`;
                  return fact.key ? (
                    <Link
                      key={`${fact.label}-${fact.value}`}
                      href={filterHref(fact.key, fact.value)}
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-1 transition hover:border-amber-300/60 hover:text-amber-100"
                      prefetch={false}
                    >
                      {label}
                    </Link>
                  ) : (
                    <span key={fact.label} className="rounded-full border border-white/20 bg-white/10 px-4 py-1">
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
                {!!character.eraTags?.length && (
                  <div className="flex flex-wrap gap-2">
                    {character.eraTags.map((era) => (
                      <Link
                        key={era}
                        href={filterHref("era", era)}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-white/70 transition hover:border-amber-300/60 hover:text-amber-100"
                        prefetch={false}
                      >
                        {era}
                      </Link>
                    ))}
                  </div>
                )}
                <p className="max-w-2xl text-base font-semibold text-white/85 lg:text-lg">{metaDescription}</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/#characters-grid"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:bg-white/20"
                  >
                    ← Back to all characters
                  </Link>
                  <Link
                    href={`/?arena=${character.slug}#arena-anchor`}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/15 px-5 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/25"
                  >
                    <Swords className="h-4 w-4" aria-hidden="true" />
                    Launch battle arena
                  </Link>
                </div>
              </div>
              <div className="w-full max-w-md lg:ml-auto">
                <GalleryCarousel
                  images={galleryImages}
                  name={character.name}
                  onActiveChange={updateHeroBackdrop}
                />
              </div>
            </div>
          </div>
        </section>
        <main className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6 lg:px-8">
          {navSections.length > 1 && (
            <nav className="mb-10 hidden flex-wrap gap-2 rounded-3xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl sm:flex">
              {navSections.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-amber-300/60 hover:text-amber-100"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
          {navSections.length > 1 && (
            <nav className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-3 backdrop-blur-xl sm:hidden">
              {navSections.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 transition hover:border-amber-300/60 hover:text-amber-100"
                >
                  {item.shortLabel || item.label}
                </a>
              ))}
            </nav>
          )}
          <section id="story" className="grid gap-10 lg:grid-cols-12">
            <article className="rounded-3xl border border-white/12 bg-white/5 p-8 shadow-[0_30px_120px_rgba(7,10,25,0.45)] backdrop-blur-xl lg:col-span-5">
              <h2 className="text-2xl font-black text-white">Story so far</h2>
              <p className="mt-2 text-sm font-semibold text-white/70">
                Catch up on {character.name}'s journey before diving deeper.
              </p>
              <div className="mt-6 max-h-[420px] space-y-4 overflow-y-auto pr-1 text-base leading-relaxed text-white/80">
                {storyParagraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </article>
            <article
              id="identity"
              className="rounded-3xl border border-white/12 bg-white/5 p-8 backdrop-blur-xl lg:col-span-7 lg:col-start-6"
            >
              <h2 className="text-2xl font-black text-white">Identity &amp; allegiances</h2>
              <p className="mt-2 text-sm font-semibold text-white/70">
                Essential identifiers, allegiances, and touchpoints.
              </p>
              <dl className="mt-6 grid gap-6 sm:grid-cols-2">
                {dossierEntries.map((entry) => (
                  <div key={entry.label} className="space-y-2">
                    <dt className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">{entry.label}</dt>
                    <dd className="flex flex-wrap gap-2 text-sm font-semibold text-white/85">
                      {(entry.values || []).map((value) =>
                        entry.key ? (
                          <Link
                            key={`${entry.label}-${value}`}
                            href={filterHref(entry.key, value)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-amber-300/60 hover:text-amber-100"
                            prefetch={false}
                          >
                            {value}
                          </Link>
                        ) : (
                          <span key={`${entry.label}-${value}`}>{value}</span>
                        )
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
            {!!allyGroups.length && (
              <article
                id="allies"
                className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-xl lg:col-span-5 lg:col-start-1"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  <Crown className="h-4 w-4 text-amber-200" aria-hidden="true" /> Allies &amp; Enclaves
                </div>
                <p className="text-sm font-semibold text-white/70">
                  Meet the trusted circles who stand with {character.name}.
                </p>
                <div className="space-y-3">
                  {allyGroups.map((group) => (
                    <div key={group.label} className="space-y-3 rounded-2xl border border-white/12 bg-black/35 p-3">
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span>{group.label}</span>
                        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">
                          {group.characters.length} dossier{group.characters.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {group.characters.map((entry) => (
                          <Link
                            key={entry.slug}
                            href={`/characters/${entry.slug}`}
                            className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:border-amber-300/60 hover:bg-amber-200/10"
                            prefetch={false}
                          >
                            <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-white/10 bg-black/40">
                              <ImageSafe
                                src={entry.cover}
                                alt={characterAltText(entry.name)}
                                fallbackLabel={entry.name}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                            <div className="mt-1 space-y-0.5 text-left">
                              <p className="text-xs font-bold text-white">{entry.name}</p>
                              {(entry.alignment || entry.status) && (
                                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">
                                  {[entry.alignment, entry.status].filter(Boolean).join(" • ")}
                                </p>
                              )}
                            </div>
                            <span className="mt-1 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-amber-200">
                              View dossier
                              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}
            {!!tags.length && (
              <article
                id="motifs"
                className="rounded-3xl border border-white/12 bg-white/5 p-8 backdrop-blur-xl lg:col-span-7 lg:col-start-6"
              >
                <h3 className="text-xl font-black text-white">Motifs &amp; Themes</h3>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  Recurring symbols and resonant ideas that define this legend.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Link
                      key={tag}
                      href={filterHref("tags", tag)}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75 transition hover:border-amber-300/60 hover:text-amber-100"
                      prefetch={false}
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </article>
            )}
            {!!powers.length && (
              <article
                id="powers"
                className="rounded-3xl border border-white/12 bg-white/5 p-8 backdrop-blur-xl lg:col-span-7 lg:col-start-6"
              >
                <h2 className="text-xl font-black text-white">Power index</h2>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  How {character.name} channels their gifts across the universe.
                </p>
                <div className="mt-6 space-y-4">
                  {powers.map((power) => {
                    const normalized = Math.max(0, Math.min(10, Number(power.level) || 0));
                    return (
                      <div key={power.name} className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-semibold text-white/80">
                          <span>{power.name}</span>
                          <span className="text-amber-200">{normalized}/10</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-300 via-fuchsia-300 to-indigo-300"
                            style={{ width: `${(normalized / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            )}
            {!!stories.length && (
              <article
                id="appearances"
                className="rounded-3xl border border-white/12 bg-white/5 p-8 backdrop-blur-xl lg:col-span-7 lg:col-start-6"
              >
                <h3 className="text-xl font-black text-white">Key appearances</h3>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  Notable stories and sightings featuring this character.
                </p>
                <ul className="mt-4 space-y-3 text-sm font-semibold text-white/75">
                  {stories.map((story) => (
                    <li key={story} className="flex items-start gap-3">
                      <Sparkles className="mt-1 h-4 w-4 text-amber-200" aria-hidden="true" />
                      <span>{story}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )}
            {!!character.eraTags?.length && (
              <article
                id="timelines"
                className="rounded-3xl border border-white/12 bg-white/5 p-8 backdrop-blur-xl lg:col-span-5"
              >
                <h3 className="text-xl font-black text-white">Era timeline</h3>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  Where this legend fits within the LoreMaker ages.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {character.eraTags.map((era) => (
                    <Link
                      key={era}
                      href={filterHref("era", era)}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75 transition hover:border-amber-300/60 hover:text-amber-100"
                      prefetch={false}
                    >
                      {era}
                    </Link>
                  ))}
                </div>
              </article>
            )}
          </section>
          {connectionSections.length > 0 && (
            <section id="connections" className="space-y-8">
              <div>
                <h2 className="text-2xl font-black text-white">Connected legends</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-white/70">
                  Explore the allies, rivals, and territories intertwined with {character.name}.
                </p>
              </div>
              {connectionSections.map((section) => (
                <div key={section.title} className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                    <section.icon className="h-4 w-4 text-amber-200" aria-hidden="true" />
                    {section.title}
                  </div>
                  {section.groups.map((group) => (
                    <div
                      key={group.label}
                      className="space-y-3 rounded-3xl border border-white/12 bg-white/5 p-3 backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-black text-white">{group.label}</h3>
                        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">
                          {group.characters.length} dossier{group.characters.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {group.characters.map((entry) => (
                          <Link
                            key={entry.slug}
                            href={`/characters/${entry.slug}`}
                            className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/35 p-2 transition hover:border-amber-300/60 hover:bg-amber-200/10"
                          >
                            <div className="aspect-square w-full overflow-hidden rounded-lg border border-white/10 bg-white/5">
                              <ImageSafe
                                src={entry.cover}
                                alt={characterAltText(entry.name)}
                                fallbackLabel={entry.name}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                            <div className="mt-2 space-y-0.5">
                              <p className="text-sm font-bold text-white">{entry.name}</p>
                              {(entry.alignment || entry.status) && (
                                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">
                                  {[entry.alignment, entry.status].filter(Boolean).join(" • ")}
                                </p>
                              )}
                            </div>
                            <span className="mt-2 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-amber-200">
                              View dossier
                              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
          {!!related.length && (
            <section id="related" className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black text-white">Discover more legends</h2>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
                >
                  Return to all characters
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/characters/${item.slug}`}
                    className="group overflow-hidden rounded-xl border border-white/12 bg-white/5 p-4 transition hover:border-amber-300/60 hover:bg-amber-200/10"
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      <ImageSafe
                        src={item.cover}
                        alt={characterAltText(item.name)}
                        fallbackLabel={item.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-lg font-bold text-white">{item.name}</p>
                      {item.shortDesc && <p className="text-sm font-semibold text-white/70">{item.shortDesc}</p>}
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-200">
                      View dossier
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>
        <SiteFooter onRandomCharacter={handleRandomCharacter} arenaHref="/#arena-anchor" />
        <ScrollShortcuts />
      </div>
    </>
  );
}

async function loadCharacters() {
  try {
    const fetched = await fetchCharactersFromSheets();
    if (Array.isArray(fetched) && fetched.length) {
      return ensureUniqueSlugs(fetched.map((character) => sanitizeCharacter(character)));
    }
  } catch (error) {
    console.warn("[character-profile] Falling back to bundled characters", error);
  }
  return ensureUniqueSlugs(
    fallbackCharacters.map((character, index) => {
      const entry = sanitizeCharacter(character);
      if (entry && typeof entry.sourceIndex !== "number") {
        entry.sourceIndex = index;
      }
      return entry;
    })
  ).filter(Boolean);
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
  const connections = buildConnections(characters, character);

  return {
    props: {
      character,
      canonicalUrl,
      related,
      schemaJson,
      connections,
    },
    revalidate: 600,
  };
}
