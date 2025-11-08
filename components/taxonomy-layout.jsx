import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RefreshCcw, Shuffle, Swords, Users, Sparkles, ChevronDown, Image as ImageIcon } from "lucide-react";

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

function firstMemberPortrait(members = []) {
  if (!Array.isArray(members)) return null;
  for (const member of members) {
    if (member?.cover) return member.cover;
  }
  return null;
}

function sampleMembers(members = [], count = 6) {
  if (!Array.isArray(members) || !members.length) return [];
  const pool = members.filter((member) => member && (member.cover || member.gallery?.length));
  if (!pool.length) return [];
  const limit = Math.min(count, pool.length);
  const used = new Set();
  const results = [];
  while (results.length < limit) {
    const index = Math.floor(Math.random() * pool.length);
    const candidate = pool[index];
    const key = candidate?.id || candidate?.slug || index;
    if (used.has(key)) continue;
    used.add(key);
    results.push(candidate);
  }
  return results;
}

function HeroRosterGrid({ members = [], onOpen }) {
  const [activeId, setActiveId] = useState(null);
  if (!members.length) return null;

  return (
    <div className="rounded-3xl border border-white/12 bg-white/5 p-4 backdrop-blur-2xl">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {members.map((member) => {
          if (!member) return null;
          const descriptor =
            (Array.isArray(member.alias) && member.alias[0]) ||
            member.identity ||
            member.alignment ||
            member.primaryLocation ||
            "Legend";
          const isDimmed = activeId && activeId !== member.id;
          const handleEnter = () => setActiveId(member.id || member.slug || null);
          const handleLeave = () => setActiveId(null);
          return (
            <button
              key={member.id || member.slug}
              type="button"
              onClick={() => onOpen?.(member)}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              onFocus={handleEnter}
              onBlur={handleLeave}
              className={classNames(
                "group relative overflow-hidden rounded-2xl border border-white/15 bg-black/40 text-left transition",
                isDimmed ? "opacity-40" : "opacity-100"
              )}
            >
              <div className="aspect-[4/5] w-full overflow-hidden">
                <ImageSafe
                  src={member.cover || member.gallery?.[0]}
                  alt={characterAltText(member.name)}
                  fallbackLabel={member.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col gap-1">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/65">{descriptor}</span>
                <span className="text-lg font-black text-white drop-shadow">{member.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
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

export function GuessTheVictorSection({ roster, onOpen }) {
  const contenders = useMemo(() => (roster || []).filter((item) => hasPortrait(item)), [roster]);
  const [pair, setPair] = useState(() => pickRandomPair(contenders));
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState("duel");
  const [animating, setAnimating] = useState(false);
  const [portraitStep, setPortraitStep] = useState({});
  const [message, setMessage] = useState(null);

  const shufflePair = useCallback(() => {
    const fresh = pickRandomPair(contenders);
    setPair(fresh);
    setGuess(null);
    setResult(null);
    setMessage(null);
    setPortraitStep({});
  }, [contenders]);

  useEffect(() => {
    shufflePair();
    setExpanded(false);
  }, [shufflePair]);

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => !value);
  }, []);

  const setBattleMode = useCallback((value) => {
    setMode(value);
    setResult(null);
    setGuess(null);
    setMessage(null);
  }, []);

  const cyclePortrait = useCallback((fighter) => {
    if (!fighter) return;
    const sources = [fighter.cover, ...(fighter.gallery || [])].filter(Boolean);
    if (!sources.length) return;
    setPortraitStep((current) => {
      const index = current[fighter.id] ?? 0;
      return { ...current, [fighter.id]: (index + 1) % sources.length };
    });
  }, []);

  const queueOpponents = useCallback(
    (champion, rival) => {
      const base = rival ? [rival] : [];
      if (mode === "duel") return base;
      const desired = mode === "championship-3" ? 3 : 4;
      const needed = Math.max(0, desired - base.length);
      const pool = contenders.filter(
        (entry) => entry.id !== champion.id && !base.some((item) => item.id === entry.id)
      );
      const extras = [];
      const mutable = [...pool];
      while (extras.length < needed && mutable.length) {
        const idx = Math.floor(Math.random() * mutable.length);
        extras.push(mutable[idx]);
        mutable.splice(idx, 1);
      }
      return [...base, ...extras];
    },
    [mode, contenders]
  );

  const choose = useCallback(
    (candidateId) => {
      if (!pair.length || result || animating) return;
      const champion = pair.find((entry) => entry.id === candidateId);
      const rival = pair.find((entry) => entry.id !== candidateId);
      if (!champion || !rival) return;
      setGuess(candidateId);
      const opponents = queueOpponents(champion, rival);
      setAnimating(true);
      const matches = [];
      let championWins = true;
      for (const opponent of opponents) {
        const outcome = simulateDuel(champion, opponent);
        matches.push({ opponent, outcome });
        if (outcome.winner?.id !== champion.id) {
          championWins = false;
          break;
        }
      }
      const finalMatch = matches[matches.length - 1] || null;
      const finalWinner = finalMatch?.outcome?.winner || champion;
      const finalLoser = finalMatch?.outcome?.loser || rival;
      setResult({ champion, matches, championWins, finalWinner, finalLoser, mode });
      setMessage(championWins ? `${champion.name} Wins` : `${champion.name} Loses`);
      setTimeout(() => setAnimating(false), 1200);
    },
    [pair, result, animating, queueOpponents, mode]
  );

  const rematch = useCallback(() => {
    setGuess(null);
    setResult(null);
    setMessage(null);
    setAnimating(false);
  }, []);

  const nextOpponents = useCallback(() => {
    shufflePair();
  }, [shufflePair]);

  if (!contenders.length || pair.length < 2) {
    return null;
  }

  const [left, right] = pair;
  const lastMatch = result?.matches?.[result.matches.length - 1] || null;
  const roundLogs = lastMatch?.outcome?.logs || [];
  const championName = result?.champion?.name || left?.name;
  const challengerName = lastMatch?.opponent?.name || right?.name;

  const summaryBar = (
    <button
      type="button"
      onClick={toggleExpanded}
      className="group flex w-full items-center justify-between gap-3 rounded-full border border-white/12 bg-black/40 px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.35em] text-white/70 transition hover:border-amber-300/60 hover:text-white"
      aria-expanded={expanded}
    >
      <span className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
        {message || "Predict the victor"}
      </span>
      <span className="flex items-center gap-2 text-[0.65rem] font-bold text-white/60">
        {expanded ? "Collapse" : "Unfold"}
        <ChevronDown
          className={classNames(
            "h-3.5 w-3.5 transition-transform",
            expanded ? "rotate-180 text-amber-200" : "text-white/50 group-hover:text-amber-200"
          )}
          aria-hidden="true"
        />
      </span>
    </button>
  );

  const fighterCard = (fighter) => {
    if (!fighter) return null;
    const descriptor = fighter.alias?.[0] || fighter.identity || fighter.alignment || fighter.primaryLocation || "Legend";
    const imageSources = [fighter.cover, ...(fighter.gallery || [])].filter(Boolean);
    const portraitIndex = portraitStep[fighter.id] ?? 0;
    const portrait = imageSources.length ? imageSources[portraitIndex % imageSources.length] : fighter.cover;
    const isWinner = result && result.finalWinner?.id === fighter.id;
    const isLoser = result && result.finalLoser?.id === fighter.id;
    const isChosen = guess === fighter.id;
    const handleSelect = () => {
      if (result) return;
      choose(fighter.id);
    };
    const handleKey = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSelect();
      }
    };
    return (
      <div
        key={fighter.id}
        role="button"
        tabIndex={0}
        onClick={handleSelect}
        onKeyDown={handleKey}
        className={classNames(
          "relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/12 bg-black/40 backdrop-blur-xl transition",
          animating ? "animate-duel-shake" : "",
          isWinner
            ? "ring-4 ring-emerald-300"
            : isLoser
            ? "ring-2 ring-rose-400/70"
            : isChosen
            ? "ring-2 ring-amber-200/70"
            : "hover:ring-2 hover:ring-amber-200/60"
        )}
      >
        <div className="relative aspect-square overflow-hidden">
          <ImageSafe
            src={portrait || fighter.cover || fighter.gallery?.[0]}
            alt={characterAltText(fighter.name)}
            fallbackLabel={fighter.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/75" aria-hidden="true" />
          <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1 text-left">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/65">{descriptor}</span>
            <span className="text-xl font-black text-white drop-shadow">{fighter.name}</span>
          </div>
          {imageSources.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                cyclePortrait(fighter);
              }}
              className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-black/80"
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Change view
            </button>
          )}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/70">
              {result ? (isWinner ? "Victor" : isLoser ? "Fallen" : "Resolved") : "Tap anywhere to choose"}
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-3 p-4 text-sm text-white/75">
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
            {(fighter.faction || []).slice(0, 2).map((label) => (
              <span key={label} className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                {label}
              </span>
            ))}
            {(fighter.locations || [fighter.primaryLocation])
              .filter(Boolean)
              .slice(0, 1)
              .map((label) => (
                <span key={label} className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  {label}
                </span>
              ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">{mode === "duel" ? "Single clash" : "Championship"}</span>
            {fighter.slug && (
              <Link
                href={`/characters/${fighter.slug}`}
                onClick={(event) => event.stopPropagation()}
                className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 transition hover:text-amber-100"
              >
                Full profile
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!expanded) {
    return <section className="rounded-3xl border border-white/12 bg-white/5 p-2 backdrop-blur-2xl">{summaryBar}</section>;
  }

  return (
    <section className="space-y-6 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">Predict the victor</h2>
          <p className="text-sm font-semibold text-white/70">
            Call the duel, or stage a championship run across three or four challengers. Every guess shapes your legend.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={nextOpponents}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reload
          </button>
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/70">
            <span className="hidden px-2 text-white/60 sm:inline">Championship</span>
            {[
              { id: "duel", label: "Duel" },
              { id: "championship-3", label: "3 Legends" },
              { id: "championship-4", label: "4 Legends" },
            ].map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setBattleMode(entry.id)}
                className={classNames(
                  "rounded-full px-3 py-1 transition",
                  mode === entry.id ? "bg-amber-300/20 text-amber-100" : "text-white/60 hover:text-white"
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {summaryBar}
        </div>
      </div>
      <div className="relative">
        <div className="grid grid-cols-2 gap-4">
          {fighterCard(left)}
          {fighterCard(right)}
        </div>
        {animating && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-amber-300/60 bg-black/70 p-4 shadow-[0_0_60px_rgba(251,191,36,0.35)]">
              <Swords className="h-10 w-10 text-amber-200 animate-duel-swords" aria-hidden="true" />
            </div>
          </div>
        )}
        {roundLogs.length > 0 && championName && challengerName && (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 flex-col items-center justify-center gap-2">
            {roundLogs.map((log) => (
              <div
                key={log.swing}
                className="rounded-full border border-white/20 bg-black/70 px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/75"
              >
                Round {log.swing}: {championName?.split(" ")[0]} {log.h1} • {challengerName?.split(" ")[0]} {log.h2}
              </div>
            ))}
          </div>
        )}
        {result && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-white/20 bg-black/85 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white shadow-xl">
              <button
                type="button"
                onClick={rematch}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white transition hover:bg-white/20"
              >
                Rematch
              </button>
              <button
                type="button"
                onClick={nextOpponents}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white transition hover:bg-white/20"
              >
                New duel
              </button>
              <button
                type="button"
                onClick={() => {
                  setBattleMode("championship-3");
                  rematch();
                }}
                className="rounded-full border border-amber-300/50 bg-amber-300/15 px-3 py-1 text-amber-100 transition hover:bg-amber-300/25"
              >
                3 legends
              </button>
              <button
                type="button"
                onClick={() => {
                  setBattleMode("championship-4");
                  rematch();
                }}
                className="rounded-full border border-amber-300/50 bg-amber-300/15 px-3 py-1 text-amber-100 transition hover:bg-amber-300/25"
              >
                4 legends
              </button>
            </div>
          </div>
        )}
      </div>
      {result && (
        <div className="rounded-2xl border border-white/10 bg-black/45 p-5 text-sm text-white/80">
          <div className="flex flex-wrap items-center gap-2 text-base font-black text-white">
            {message}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(result.matches || []).map((match, index) => (
              <div key={match.opponent?.id || index} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                  <span>Round {index + 1}</span>
                  <span>{match.opponent?.name}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white/75">
                  {match.outcome.winner?.id === result.champion?.id
                    ? `${result.champion?.name} outmaneuvered ${match.opponent?.name}.`
                    : `${match.opponent?.name} overwhelmed ${result.champion?.name}.`}
                </p>
              </div>
            ))}
          </div>
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
  const sharedBackground =
    background ||
    firstMemberPortrait(current?.members || []) ||
    entries.reduce((acc, entry) => acc || firstMemberPortrait(entry.members || []), null) ||
    null;
  const heroMembers = useMemo(() => {
    if (!current) return [];
    return sampleMembers(current.members || [], 6);
  }, [current?.slug]);
  const navLinks = useMemo(
    () => [
      { href: "/factions", label: "Factions" },
      { href: "/locations", label: "Locations" },
      { href: "/powers", label: "Powers" },
      { href: "/timelines", label: "Timelines" },
    ],
    []
  );
  const navClasses = useCallback(
    (href) =>
      classNames(
        "rounded-full px-2 py-1 transition",
        basePath === href
          ? "bg-white/15 text-white shadow-[0_0_20px_rgba(255,255,255,0.25)]"
          : "text-white/70 hover:text-white"
      ),
    [basePath]
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050813] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-20">
          {sharedBackground ? (
            <ImageSafe
              src={sharedBackground}
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
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-12 sm:px-8 lg:px-12">
          <header
            className="hero-header relative w-full overflow-hidden rounded-[32px] border border-white/20 bg-black/35 px-5 py-4 backdrop-blur-3xl shadow-[0_24px_80px_rgba(8,10,26,0.6)]"
            style={
              sharedBackground
                ? {
                    "--hero-header-image": `url(${sharedBackground.replace(/"/g, "\\\"")})`,
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
                  {navLinks.map((item) => (
                    <Link key={item.href} href={item.href} className={navClasses(item.href)}>
                      {item.label}
                    </Link>
                  ))}
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
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">{badgeLabel}</p>
                <h1 className="text-4xl font-black leading-tight text-balance sm:text-5xl lg:text-6xl">{title}</h1>
                <p className="max-w-xl text-sm font-semibold text-white/75 sm:text-base">{description}</p>
              </div>
              {heroMembers.length ? (
                <>
                  <HeroRosterGrid members={heroMembers} />
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                    Hover or tap to spotlight legends tied to this focus.
                  </p>
                </>
              ) : (
                <p className="rounded-3xl border border-white/12 bg-white/5 p-4 text-sm font-semibold text-white/75 backdrop-blur-2xl">
                  {description}
                </p>
              )}
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
              <div className="relative w-full overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-2xl">
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
            Stage a lore clash and see which team dominates the LoreMaker Universe.
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
  const navLinks = [
    { href: "/factions", label: "Factions" },
    { href: "/locations", label: "Locations" },
    { href: "/powers", label: "Powers" },
    { href: "/timelines", label: "Timelines" },
  ];
  const navClasses = (href) =>
    classNames(
      "rounded-full px-2 py-1 transition",
      basePath === href
        ? "bg-white/15 text-white shadow-[0_0_20px_rgba(255,255,255,0.25)]"
        : "text-white/70 hover:text-white"
    );
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
                {navLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={navClasses(item.href)}>
                    {item.label}
                  </Link>
                ))}
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
      <ScrollShortcuts />
    </div>
  );
}
