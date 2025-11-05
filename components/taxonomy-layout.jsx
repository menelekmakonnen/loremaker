import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RefreshCcw, Shuffle, Swords, Users } from "lucide-react";

import ImageSafe, { characterAltText, Insignia } from "./image-safe";
import SiteFooter from "./site-footer";
import ScrollShortcuts from "./scroll-shortcuts";

const SLIDE_VARIANTS = {
  enter: (direction = 1) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.96,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction = 1) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
    scale: 0.96,
  }),
};

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function normaliseSlides(entries = []) {
  const filtered = entries.filter((entry) => entry && entry.slug);
  const limit = filtered.length ? Math.min(filtered.length, 6) : 0;
  return filtered
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      background: entry.primaryImage || entry.members?.[0]?.cover || null,
    }));
}

function hasPortrait(entity) {
  if (!entity) return false;
  if (entity.cover) return true;
  if (Array.isArray(entity.gallery) && entity.gallery.some(Boolean)) return true;
  return false;
}

function pickRandomPair(roster = []) {
  if (!Array.isArray(roster) || roster.length < 2) return [];
  const firstIndex = Math.floor(Math.random() * roster.length);
  let secondIndex = Math.floor(Math.random() * (roster.length - 1));
  if (secondIndex >= firstIndex) {
    secondIndex += 1;
  }
  const a = roster[firstIndex];
  const b = roster[secondIndex];
  if (!a || !b || a.id === b.id) {
    const fallback = roster.filter((entry) => entry && entry.id !== a?.id);
    const replacement = fallback[Math.floor(Math.random() * fallback.length)] || null;
    return replacement ? [a, replacement] : [a, b].filter(Boolean);
  }
  return [a, b];
}

function powerOriginProfile(entry = {}) {
  const text = [
    Array.isArray(entry.tags) ? entry.tags.join(" ") : entry.tags || "",
    Array.isArray(entry.alias) ? entry.alias.join(" ") : entry.alias || "",
    entry.longDesc || "",
    entry.shortDesc || "",
  ]
    .join(" ")
    .toLowerCase();
  if (/god|deity|celestial|primordial/.test(text) || /old gods|ancient/.test(entry.era || "")) {
    return { label: "Divine", multiplier: 1.55 };
  }
  if (/alien|extraterrestrial|cosmic/.test(text)) {
    return { label: "Alien", multiplier: 1.28 };
  }
  if (/demon|spirit|ethereal|angel|occult/.test(text)) {
    return { label: "Mythic", multiplier: 1.22 };
  }
  if (/meta|mutant|enhanced|super/.test(text)) {
    return { label: "Enhanced", multiplier: 1.14 };
  }
  return { label: "Legend", multiplier: 1.06 };
}

function scoreCharacter(entry = {}) {
  const powerTotal = (entry.powers || []).reduce((sum, power) => sum + (Number(power?.level) || 0), 0);
  const elite = Array.isArray(entry.tags) && entry.tags.some((tag) => /legend|mythic|prime|leader/i.test(tag)) ? 3 : 0;
  const origin = powerOriginProfile(entry);
  return Math.round((powerTotal + elite + (entry.metrics?.averageLevel || 0)) * origin.multiplier || 1);
}

function rngLuck(max) {
  const span = Math.max(0, max);
  return Math.round((Math.random() * 2 - 1) * 0.18 * span);
}

function simulateDuel(c1, c2) {
  const s1 = scoreCharacter(c1);
  const s2 = scoreCharacter(c2);
  const maxBase = Math.max(s1, s2) || 1;
  const swings = 3;
  let h1 = 100;
  let h2 = 100;
  const logs = [];
  for (let i = 0; i < swings; i += 1) {
    const luck1 = rngLuck(maxBase);
    const luck2 = rngLuck(maxBase);
    const offensive1 = s1 + luck1;
    const offensive2 = s2 + luck2;
    const shield1 = s1 * 0.35;
    const shield2 = s2 * 0.35;
    const delta1 = Math.max(0, offensive1 - shield2);
    const delta2 = Math.max(0, offensive2 - shield1);
    const combined = Math.max(1, delta1 + delta2);
    const dmg1 = Math.round((delta1 / combined) * 48);
    const dmg2 = Math.round((delta2 / combined) * 48);
    h2 = Math.max(0, h2 - dmg1);
    h1 = Math.max(0, h1 - dmg2);
    logs.push({ swing: i + 1, h1, h2 });
  }
  let winner;
  if (h1 === h2) {
    winner = s1 === s2 ? (Math.random() > 0.5 ? c1 : c2) : s1 > s2 ? c1 : c2;
  } else {
    winner = h1 > h2 ? c1 : c2;
  }
  const loser = winner === c1 ? c2 : c1;
  return { winner, loser, h1, h2, logs };
}

function GuessTheVictorSection({ roster, onOpen }) {
  const contenders = useMemo(() => (roster || []).filter((item) => hasPortrait(item)), [roster]);
  const [pair, setPair] = useState(() => pickRandomPair(contenders));
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setPair(pickRandomPair(contenders));
    setGuess(null);
    setResult(null);
  }, [contenders]);

  const choose = useCallback(
    (candidate) => {
      if (!pair || pair.length < 2 || result) return;
      setGuess(candidate);
      const [left, right] = pair;
      if (!left || !right) return;
      const duelResult = simulateDuel(left, right);
      setResult(duelResult);
    },
    [pair, result]
  );

  const nextRound = useCallback(() => {
    setPair(pickRandomPair(contenders));
    setGuess(null);
    setResult(null);
  }, [contenders]);

  if (!contenders.length || pair.length < 2) {
    return null;
  }

  const [left, right] = pair;
  const guessedCorrect = result && result.winner?.id === guess;

  const fighterCard = (fighter) => {
    if (!fighter) return null;
    const active = result && result.winner?.id === fighter.id;
    const descriptor = fighter.alias?.[0] || fighter.identity || fighter.alignment || fighter.primaryLocation || "Legend";
    return (
      <div
        key={fighter.id}
        className={classNames(
          "flex h-full flex-col overflow-hidden rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur-xl",
          active ? "ring-4 ring-emerald-300" : guess === fighter.id ? "ring-2 ring-amber-300/70" : "ring-1 ring-white/10"
        )}
      >
        <button
          type="button"
          onClick={() => onOpen?.(fighter)}
          className="relative overflow-hidden rounded-2xl border border-white/15"
        >
          <ImageSafe
            src={fighter.cover || fighter.gallery?.[0]}
            alt={characterAltText(fighter.name)}
            fallbackLabel={fighter.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-4 text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">{descriptor}</span>
            <span className="text-lg font-black text-white">{fighter.name}</span>
          </div>
        </button>
        <div className="mt-3 flex flex-1 flex-col gap-3 text-sm text-white/75">
          <div className="flex flex-wrap gap-2">
            {(fighter.faction || []).slice(0, 2).map((label) => (
              <span key={label} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => choose(fighter.id)}
            disabled={Boolean(result)}
            className={classNames(
              "mt-auto inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition",
              result && active
                ? "border border-emerald-300/70 bg-emerald-300/15 text-emerald-100"
                : result
                ? "border border-white/15 bg-white/5 text-white/60"
                : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {result ? (active ? "Victor" : "Battle complete") : `I choose ${fighter.alias?.[0] || fighter.name}`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-6 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Predict the Victor</h2>
          <p className="text-sm font-semibold text-white/70">Tap your champion, then watch the factions clash.</p>
        </div>
        {result && (
          <span
            className={classNames(
              "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em]",
              guessedCorrect ? "border-emerald-300/70 bg-emerald-300/15 text-emerald-100" : "border-rose-400/60 bg-rose-400/15 text-rose-100"
            )}
          >
            {guessedCorrect ? "Prophecy fulfilled" : "Fate disagreed"}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fighterCard(left)}
        {fighterCard(right)}
      </div>
      {result && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/80">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="text-white/70">Winner:</span>
            <span className="text-base font-black text-white">{result.winner?.name}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.logs.map((log) => (
              <div key={log.swing} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Round {log.swing}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                  <span>
                    {left?.name}: <strong className="text-white">{log.h1}</strong>
                  </span>
                  <span>
                    {right?.name}: <strong className="text-white">{log.h2}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={nextRound}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Another round
          </button>
        </div>
      )}
    </section>
  );
}

function useAutoAdvance(length, handler) {
  const timerRef = useRef(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    cancel();
    if (length <= 1) return;
    timerRef.current = setTimeout(() => {
      handlerRef.current?.();
      schedule();
    }, 60000);
  }, [cancel, length]);

  useEffect(() => schedule(), [schedule]);
  useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
}

export function TaxonomyIndexLayout({
  title,
  description,
  entries,
  basePath,
  badgeLabel = "LoreMaker Universe",
  enableArena = false,
  characters = [],
}) {
  const slides = useMemo(() => normaliseSlides(entries), [entries]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const guessRoster = useMemo(() => {
    if (characters && characters.length) return characters;
    return entries.flatMap((entry) => entry.members || []);
  }, [characters, entries]);

  useEffect(() => {
    if (!slides.length) {
      setIndex(0);
      return;
    }
    setIndex((value) => (value >= slides.length ? slides.length - 1 : value));
  }, [slides.length]);

  const advance = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection(1);
    setIndex((value) => (value + 1) % slides.length);
  }, [slides.length]);

  const { schedule, cancel } = useAutoAdvance(slides.length, advance);

  const goNext = useCallback(() => {
    advance();
    schedule();
  }, [advance, schedule]);

  const goPrev = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection(-1);
    setIndex((value) => (value - 1 + slides.length) % slides.length);
    schedule();
  }, [slides.length, schedule]);

  const current = slides[index] || slides[0] || null;
  const background = current?.background || slides.find((slide) => slide.background)?.background || null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050813] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-20">
          {background ? (
            <ImageSafe
              src={background}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
              aria-hidden="true"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-black via-[#060a1c] to-[#04060f]" aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-[#050a1a]/75 to-[#050813]/85" aria-hidden="true" />
        </div>
        <div className="relative z-10 flex min-h-[80vh] flex-col px-4 pb-12 pt-12 sm:px-8 lg:px-16">
          <header
            className="hero-header relative w-full overflow-hidden rounded-[32px] border border-white/20 bg-black/35 px-5 py-4 backdrop-blur-3xl shadow-[0_24px_80px_rgba(8,10,26,0.6)]"
            style={
              background
                ? {
                    "--hero-header-image": `url(${background.replace(/"/g, "\\\"")})`,
                  }
                : undefined
            }
          >
            <div className="relative z-10 flex w-full flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                <Link
                  href="/"
                  className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-white transition hover:bg-white/20"
                >
                  Loremaker
                </Link>
                <nav className="flex flex-wrap items-center gap-2 text-[0.65rem] tracking-[0.3em] sm:text-xs">
                  <Link href="/factions" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                    Factions
                  </Link>
                  <Link href="/locations" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                    Locations
                  </Link>
                  <Link href="/powers" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                    Powers
                  </Link>
                  <Link href="/timelines" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                    Timelines
                  </Link>
                </nav>
              </div>
              <a
                href="https://menelekmakonnen.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/85 transition hover:bg-white/20"
              >
                Menelek Makonnen
              </a>
            </div>
          </header>
          <div className="mt-10 flex flex-1 flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
            <div className="max-w-2xl space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">{badgeLabel}</p>
              <h1 className="text-4xl font-black leading-tight text-balance sm:text-5xl lg:text-6xl">{title}</h1>
              <p className="max-w-xl text-sm font-semibold text-white/80 sm:text-base">{description}</p>
              {current && (
                <div className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                      Spotlight dossier
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      {current.memberCount} dossier{current.memberCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <h2 className="text-2xl font-black text-white sm:text-3xl">{current.name}</h2>
                  {current.summary && <p className="text-sm font-semibold text-white/70">{current.summary}</p>}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`${basePath}/${current.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-100 transition hover:bg-amber-300/30"
                    >
                      Open dossier
                    </Link>
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
                    >
                      Next spotlight
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-5">
              <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-2xl">
                <AnimatePresence initial={false} custom={direction}>
                  {current ? (
                    <motion.div
                      key={current.slug}
                      variants={SLIDE_VARIANTS}
                      custom={direction}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                    >
                      <div className="space-y-3 text-sm font-semibold text-white/70">
                        {(current.snippets || []).slice(0, 3).map((snippet, idx) => (
                          <p key={idx} className="rounded-2xl border border-white/10 bg-black/40 p-3">
                            “{snippet}”
                          </p>
                        ))}
                        {!current.snippets?.length && (
                          <p className="rounded-2xl border border-white/10 bg-black/40 p-3">
                            Fresh intelligence incoming from the LoreMaker archives.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-[0_12px_40px_rgba(8,10,26,0.55)]">
                          {current.primaryImage ? (
                            <ImageSafe
                              src={current.primaryImage}
                              alt={characterAltText(current.name)}
                              fallbackLabel={current.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Insignia label={current.name} size={52} />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={goPrev}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={goNext}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="grid gap-3 text-sm font-semibold text-white/60">
                      Awaiting featured dossiers from the LoreMaker archive.
                    </div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex gap-3 overflow-x-auto rounded-3xl border border-white/12 bg-white/5 p-4 backdrop-blur-2xl">
                {slides.map((slide, slideIndex) => (
                  <button
                    key={slide.slug}
                    type="button"
                    onClick={() => {
                      cancel();
                      setDirection(slideIndex > index ? 1 : -1);
                      setIndex(slideIndex);
                      schedule();
                    }}
                    className={classNames(
                      "flex min-w-[160px] flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition",
                      slideIndex === index
                        ? "border-amber-300/60 bg-amber-200/10 text-white"
                        : "border-white/10 bg-black/30 text-white/70 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/15 bg-black/40">
                        {slide.primaryImage ? (
                          <ImageSafe
                            src={slide.primaryImage}
                            alt={characterAltText(slide.name)}
                            fallbackLabel={slide.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Insignia label={slide.name} size={32} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black leading-tight text-white">{slide.name}</p>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/60">
                          {slide.memberCount} dossier{slide.memberCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <main className="relative z-10 mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        {enableArena && entries.length > 1 && <FactionArena entries={entries} basePath={basePath} />}
        <GuessTheVictorSection roster={guessRoster} />
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-black text-white">Archive dossiers</h2>
            <span className="text-sm font-semibold text-white/60">
              {entries.length} dossier{entries.length === 1 ? "" : "s"} documented
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {entries.map((entry) => (
              <Link
                key={entry.slug}
                href={`${basePath}/${entry.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/12 bg-black/45 p-5 backdrop-blur-2xl shadow-[0_24px_80px_rgba(8,10,26,0.55)] transition hover:border-amber-300/60 hover:bg-black/60"
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  <span>{entry.memberCount} dossier{entry.memberCount === 1 ? "" : "s"}</span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.65rem]">{entry.type}</span>
                </div>
                <div className="mt-4 flex items-start gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/20 bg-black/40 shadow-[0_12px_40px_rgba(8,10,26,0.55)]">
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
                    <h3 className="text-2xl font-black text-white sm:text-3xl">{entry.name}</h3>
                    <p className="text-sm font-semibold text-white/70 line-clamp-3">{entry.summary}</p>
                  </div>
                </div>
                {entry.snippets?.length > 0 && (
                  <ul className="mt-4 space-y-2 text-sm font-semibold text-white/60">
                    {entry.snippets.slice(0, 2).map((snippet, snippetIndex) => (
                      <li key={snippetIndex} className="line-clamp-2">
                        “{snippet}”
                      </li>
                    ))}
                  </ul>
                )}
                <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                  Explore dossier
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter arenaHref={enableArena ? "#faction-arena" : "#arena-anchor"} />
      <ScrollShortcuts />
    </div>
  );
}

function FactionArena({ entries, basePath }) {
  const roster = useMemo(() => entries.filter((entry) => entry && entry.slug), [entries]);
  const [left, setLeft] = useState(() => roster[0] || null);
  const [right, setRight] = useState(() => roster[1] || roster[0] || null);
  const [result, setResult] = useState(null);

  const selectBySlug = useCallback((slug) => roster.find((entry) => entry.slug === slug) || null, [roster]);

  const chooseRandom = useCallback(
    (excludeSlug) => {
      if (!roster.length) return null;
      const pool = roster.filter((entry) => (excludeSlug ? entry.slug !== excludeSlug : true));
      const source = pool.length ? pool : roster;
      return source[Math.floor(Math.random() * source.length)];
    },
    [roster]
  );

  const randomise = useCallback(
    (setter, opponent) => {
      const target = chooseRandom(opponent?.slug);
      setter(target);
      setResult(null);
    },
    [chooseRandom]
  );

  const resolveDuel = useCallback(
    (l = left, r = right) => {
      if (!l || !r) return;
      const leftWeight = Math.max(1, l.memberCount || 1);
      const rightWeight = Math.max(1, r.memberCount || 1);
      const total = leftWeight + rightWeight;
      const roll = Math.random() * total;
      const winner = roll <= leftWeight ? l : r;
      const loser = winner === l ? r : l;
      setResult({
        winner,
        loser,
        narrative: `${winner.name} orchestrate a decisive maneuver, outclassing ${loser.name} on the LoreMaker stage.`,
      });
    },
    [left, right]
  );

  const duel = useCallback(() => {
    resolveDuel();
  }, [resolveDuel]);

  const renderSlot = (label, value, setter, rival) => (
    <div className="space-y-4 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">{label}</p>
        <button
          type="button"
          onClick={() => randomise(setter, rival)}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden="true" /> Randomise
        </button>
      </div>
      <select
        value={value?.slug || ""}
        onChange={(event) => {
          const selected = selectBySlug(event.target.value);
          setter(selected);
          setResult(null);
        }}
        className="w-full rounded-2xl border border-white/25 bg-black/70 px-3 py-2 text-sm font-semibold text-white shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        <option value="">Select a faction</option>
        {roster.map((entry) => (
          <option key={entry.slug} value={entry.slug} className="bg-black text-white">
            {entry.name}
          </option>
        ))}
      </select>
      {value ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-black/40">
              {value.primaryImage ? (
                <ImageSafe
                  src={value.primaryImage}
                  alt={characterAltText(value.name)}
                  fallbackLabel={value.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black/60">
                  <Insignia label={value.name} size={48} />
                </div>
              )}
            </div>
            <div>
              <p className="text-xl font-black text-white">{value.name}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                {value.memberCount} dossier{value.memberCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          {value.summary && <p className="text-sm font-semibold text-white/70">{value.summary}</p>}
          <Link
            href={`${basePath}/${value.slug}`}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 transition hover:text-amber-100"
          >
            Open dossier
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <p className="text-sm font-semibold text-white/60">Assign a faction to prepare the arena.</p>
      )}
    </div>
  );

  return (
    <section id="faction-arena" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Faction arena</h2>
          <p className="text-sm font-semibold text-white/70">
            Stage a lore clash and see which enclave dominates the LoreMaker Universe.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const first = chooseRandom();
            const second = chooseRandom(first?.slug);
            setLeft(first);
            setRight(second);
            setResult(null);
            setTimeout(() => resolveDuel(first, second), 180);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-100 transition hover:bg-amber-300/30"
        >
          <Swords className="h-4 w-4" aria-hidden="true" />
          Random duel
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {renderSlot("Contender alpha", left, setLeft, right)}
        {renderSlot("Contender omega", right, setRight, left)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={duel}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
        >
          Commence duel
        </button>
        {result && (
          <div className="flex-1 rounded-3xl border border-amber-300/50 bg-amber-200/10 px-5 py-4 text-sm font-semibold text-amber-100">
            <div className="text-lg font-black uppercase tracking-[0.35em] text-amber-200">{result.winner.name} prevail</div>
            <p className="mt-2 text-sm text-amber-100">{result.narrative}</p>
          </div>
        )}
      </div>
    </section>
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
            <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-[#070b19]/70 to-[#050813]/80" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-black via-[#070b19] to-[#050813]" aria-hidden="true" />
        )}
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:px-8">
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
              <Link
                href="/"
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white transition hover:bg-white/20"
              >
                Loremaker
              </Link>
              <nav className="flex flex-wrap items-center gap-2 text-[0.65rem] tracking-[0.3em] sm:text-xs">
                <Link href="/factions" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                  Factions
                </Link>
                <Link href="/locations" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                  Locations
                </Link>
                <Link href="/powers" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                  Powers
                </Link>
                <Link href="/timelines" className="rounded-full px-2 py-1 text-white/70 transition hover:text-white">
                  Timelines
                </Link>
              </nav>
            </div>
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
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
        {relatedEntries.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-white">Connected lore</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedEntries.map((related) => (
                <Link
                  key={related.slug}
                  href={`${basePath}/${related.slug}`}
                  className="group overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 transition hover:border-amber-300/60 hover:bg-amber-200/10 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/20 bg-black/40">
                      {related.primaryImage ? (
                        <ImageSafe
                          src={related.primaryImage}
                          alt={characterAltText(related.name)}
                          fallbackLabel={related.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-black/60">
                          <Insignia label={related.name} size={40} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{related.name}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">{related.memberCount} dossier{related.memberCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  {related.summary && <p className="mt-3 text-sm font-semibold text-white/70">{related.summary}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter arenaHref="/#arena-anchor" />
    </div>
  );
}
