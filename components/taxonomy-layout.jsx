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

function hashString(value = "") {
  let hash = 0;
  const str = String(value);
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

function seededValue(identifier, channel, { min = 0, max = 100, dayKey = "" } = {}) {
  const base = `${identifier}|${channel}|${dayKey}`;
  const seed = hashString(base);
  const radians = seed % Math.PI;
  const normalised = (Math.sin(radians) + 1) / 2; // 0..1
  const span = max - min;
  return Math.round(min + normalised * span);
}

function collageSourcesForEntry(entry = {}, limit = 4) {
  if (!entry) return [];
  const gallery = [];
  if (entry.primaryImage) gallery.push(entry.primaryImage);
  const members = Array.isArray(entry.members) ? entry.members : [];
  for (const member of members) {
    if (gallery.length >= limit) break;
    if (member?.cover) {
      gallery.push(member.cover);
    } else if (Array.isArray(member?.gallery)) {
      const alt = member.gallery.find(Boolean);
      if (alt) gallery.push(alt);
    }
  }
  return Array.from(new Set(gallery.filter(Boolean))).slice(0, limit);
}

function resolveCharacterForMember(member, characterMap) {
  if (!member || !characterMap) return null;
  const key = member.id || member.slug;
  if (!key) return null;
  return characterMap.get(key) || null;
}

function combatScore(entity = {}, characterMap, dayKey) {
  if (!entity) return 1;
  if (entity.type === "faction") {
    const members = Array.isArray(entity.members) ? entity.members : [];
    const memberScores = members
      .map((member) => {
        const full = resolveCharacterForMember(member, characterMap) || member;
        return scoreCharacter(full);
      })
      .filter((value) => Number.isFinite(value));
    const average = memberScores.length
      ? memberScores.reduce((sum, value) => sum + value, 0) / memberScores.length
      : 40;
    const strength = Math.min(100, entity.memberCount * 6 + 30);
    const mystique = seededValue(entity.slug || entity.name, "mystique", { min: 25, max: 85, dayKey });
    return Math.round(average * 0.6 + strength * 0.25 + mystique * 0.15);
  }
  return scoreCharacter(entity);
}

function computeFactionStats(entry = {}, characterMap, dayKey) {
  if (!entry || entry.type !== "faction") return null;
  const identifier = entry.slug || entry.name;
  const members = Array.isArray(entry.members) ? entry.members : [];
  const memberScores = members
    .map((member) => {
      const full = resolveCharacterForMember(member, characterMap) || member;
      return scoreCharacter(full);
    })
    .filter((value) => Number.isFinite(value));
  const averagePower = memberScores.length
    ? memberScores.reduce((sum, value) => sum + value, 0) / memberScores.length
    : 40;
  const strength = Math.min(100, entry.memberCount * 6 + 20);
  const discipline = seededValue(identifier, "discipline", { min: 35, max: 95, dayKey });
  const mystique = seededValue(identifier, "mystique", { min: 30, max: 90, dayKey });
  const fortune = seededValue(identifier, "fortune", { min: 10, max: 100, dayKey });
  return {
    strength,
    power: Math.min(100, Math.round(averagePower)),
    discipline,
    mystique,
    fortune,
  };
}

function computeLocationStats(entry = {}, dayKey) {
  if (!entry || entry.type !== "location") return null;
  const identifier = entry.slug || entry.name;
  return {
    notoriety: seededValue(identifier, "notoriety", { min: 40, max: 98, dayKey }),
    sanctity: seededValue(identifier, "sanctity", { min: 20, max: 85, dayKey }),
    volatility: seededValue(identifier, "volatility", { min: 25, max: 90, dayKey }),
  };
}

function computePowerStats(entry = {}, dayKey) {
  if (!entry || entry.type !== "power") return null;
  const identifier = entry.slug || entry.name;
  const average = Number(entry.metrics?.averageLevel) || 0;
  return {
    mastery: Math.round((average / 10) * 100),
    volatility: seededValue(identifier, "volatility", { min: 25, max: 95, dayKey }),
    rarity: seededValue(identifier, "rarity", { min: 30, max: 90, dayKey }),
  };
}

function computeTimelineStats(entry = {}, dayKey) {
  if (!entry || entry.type !== "timeline") return null;
  const identifier = entry.slug || entry.name;
  return {
    upheaval: seededValue(identifier, "upheaval", { min: 20, max: 95, dayKey }),
    innovation: seededValue(identifier, "innovation", { min: 30, max: 90, dayKey }),
    secrecy: seededValue(identifier, "secrecy", { min: 25, max: 85, dayKey }),
  };
}

function buildVisualMetrics(entry = {}, characterMap, dayKey) {
  if (!entry) return [];
  if (entry.type === "faction") {
    const stats = computeFactionStats(entry, characterMap, dayKey);
    if (!stats) return [];
    return [
      { key: "strength", label: "Strength", value: stats.strength, type: "bar" },
      { key: "power", label: "Power", value: stats.power, type: "bar" },
      { key: "discipline", label: "Discipline", value: stats.discipline, type: "bar" },
      { key: "mystique", label: "Mystique", value: stats.mystique, type: "bar" },
      { key: "fortune", label: "Fortune", value: stats.fortune, type: "bar" },
    ];
  }
  if (entry.type === "power") {
    const stats = computePowerStats(entry, dayKey);
    if (!stats) return [];
    return [
      { key: "mastery", label: "Mastery", value: stats.mastery, type: "pie" },
      { key: "volatility", label: "Volatility", value: stats.volatility, type: "pie" },
      { key: "rarity", label: "Rarity", value: stats.rarity, type: "pie" },
    ];
  }
  if (entry.type === "location") {
    const stats = computeLocationStats(entry, dayKey);
    if (!stats) return [];
    return [
      { key: "notoriety", label: "Notoriety", value: stats.notoriety, type: "pie" },
      { key: "sanctity", label: "Sanctity", value: stats.sanctity, type: "pie" },
      { key: "volatility", label: "Volatility", value: stats.volatility, type: "pie" },
    ];
  }
  if (entry.type === "timeline") {
    const stats = computeTimelineStats(entry, dayKey);
    if (!stats) return [];
    return [
      { key: "upheaval", label: "Upheaval", value: stats.upheaval, type: "pie" },
      { key: "innovation", label: "Innovation", value: stats.innovation, type: "pie" },
      { key: "secrecy", label: "Secrecy", value: stats.secrecy, type: "pie" },
    ];
  }
  return [];
}

function HeroRosterGrid({ members = [], onOpen, activeId: controlledActiveId, onHighlight }) {
  const [internalActive, setInternalActive] = useState(null);
  const activeId = controlledActiveId ?? internalActive;

  useEffect(() => {
    if (controlledActiveId == null && members.length) {
      const first = members[0]?.id || members[0]?.slug || null;
      setInternalActive(first);
    }
  }, [members, controlledActiveId]);

  if (!members.length) return null;

  const setActive = (nextId) => {
    onHighlight?.(nextId);
    if (controlledActiveId === undefined) {
      setInternalActive(nextId);
    }
  };

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
          const key = member.id || member.slug;
          const isDimmed = activeId && key && activeId !== key;
          const highlight = () => setActive(key);
          const clear = () => {
            if (controlledActiveId === undefined) {
              setInternalActive(null);
              onHighlight?.(null);
            }
          };
          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpen?.(member)}
              onMouseEnter={highlight}
              onMouseLeave={clear}
              onFocus={highlight}
              onBlur={clear}
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

function simulateDuel(c1, c2, characterMap, dayKey) {
  const s1 = combatScore(c1, characterMap, dayKey);
  const s2 = combatScore(c2, characterMap, dayKey);
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
    logs.push({ swing: i + 1, h1, h2, luck1, luck2, offensive1, offensive2, dmg1, dmg2 });
  }
  let winner;
  if (h1 === h2) {
    winner = s1 === s2 ? (Math.random() > 0.5 ? c1 : c2) : s1 > s2 ? c1 : c2;
  } else {
    winner = h1 > h2 ? c1 : c2;
  }
  const loser = winner === c1 ? c2 : c1;
  return { winner, loser, h1, h2, logs, breakdown: { s1, s2 } };
}

function entityDescriptor(entity) {
  if (!entity) return "Legend";
  if (entity.type === "faction") {
    return `${entity.memberCount || 0} legends`;
  }
  return (
    (Array.isArray(entity.alias) && entity.alias[0]) ||
    entity.identity ||
    [entity.alignment, entity.status].filter(Boolean).join(" • ") ||
    entity.primaryLocation ||
    "Legend"
  );
}

function FactionCollage({ sources = [] }) {
  const tiles = sources.slice(0, 4);
  if (!tiles.length) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black/50">
        <Sparkles className="h-8 w-8 text-amber-200" aria-hidden="true" />
      </div>
    );
  }
  const gridClass = tiles.length === 1 ? "grid-cols-1" : tiles.length <= 2 ? "grid-cols-2" : "grid-cols-2";
  return (
    <div className={classNames("grid h-full w-full", gridClass)}>
      {tiles.map((src, index) => (
        <div key={`${src}-${index}`} className="relative overflow-hidden border border-white/10">
          <ImageSafe src={src} alt="" className="h-full w-full object-cover" loading="lazy" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/65" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function entityKey(entity) {
  if (!entity) return null;
  return entity.id || entity.slug || null;
}

function sameEntity(a, b) {
  const keyA = entityKey(a);
  const keyB = entityKey(b);
  if (!keyA || !keyB) return false;
  return keyA === keyB;
}

export function GuessTheVictorSection({ roster, onOpen, characterMap, dayKey, contextType }) {
  const rosterType = contextType || (roster?.[0]?.type || "character");
  const dateKey = dayKey || new Date().toISOString().slice(0, 10);
  const contenders = useMemo(() => {
    if (!Array.isArray(roster)) return [];
    return roster.filter((item) => {
      if (!item) return false;
      if (rosterType === "faction") {
        return (item.memberCount || 0) > 0 || collageSourcesForEntry(item).length > 0;
      }
      return hasPortrait(item);
    });
  }, [roster, rosterType]);
  const [pair, setPair] = useState(() => pickRandomPair(contenders));
  const [guess, setGuess] = useState(null);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState("duel");
  const [championshipSlots, setChampionshipSlots] = useState(3);
  const [animating, setAnimating] = useState(false);
  const [portraitStep, setPortraitStep] = useState({});
  const [message, setMessage] = useState(null);
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const shufflePair = useCallback(() => {
    const fresh = pickRandomPair(contenders);
    setPair(fresh);
    setGuess(null);
    setResult(null);
    setMessage(null);
    setPortraitStep({});
    setRevealedRounds(0);
    setShowSummary(false);
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

  const isChampionship = mode === "championship";

  const toggleChampionship = useCallback(() => {
    setBattleMode(isChampionship ? "duel" : "championship");
  }, [isChampionship, setBattleMode]);

  const selectChampionshipSlots = useCallback(
    (slots) => {
      setChampionshipSlots(slots);
      setAnimating(false);
      setBattleMode("championship");
    },
    [setBattleMode]
  );

  const cyclePortrait = useCallback((fighter) => {
    if (!fighter) return;
    const sources =
      fighter.type === "faction"
        ? collageSourcesForEntry(fighter)
        : [fighter.cover, ...(fighter.gallery || [])].filter(Boolean);
    if (!sources.length) return;
    setPortraitStep((current) => {
      const key = entityKey(fighter);
      if (!key) return current;
      const index = current[key] ?? 0;
      return { ...current, [key]: (index + 1) % sources.length };
    });
  }, []);

  const queueOpponents = useCallback(
    (champion, rival) => {
      const base = rival ? [rival] : [];
      if (!isChampionship) return base;
      const desired = Math.max(1, championshipSlots);
      const needed = Math.max(0, desired - base.length);
      const pool = contenders.filter((entry) => {
        const key = entry.id || entry.slug;
        const championKey = champion.id || champion.slug;
        if (key === championKey) return false;
        return !base.some((item) => (item.id || item.slug) === key);
      });
      const extras = [];
      const mutable = [...pool];
      while (extras.length < needed && mutable.length) {
        const idx = Math.floor(Math.random() * mutable.length);
        extras.push(mutable[idx]);
        mutable.splice(idx, 1);
      }
      return [...base, ...extras];
    },
    [isChampionship, championshipSlots, contenders]
  );

  const choose = useCallback(
    (candidateId) => {
      if (!pair.length || result || animating) return;
      const champion = pair.find((entry) => entityKey(entry) === candidateId);
      const rival = pair.find((entry) => entityKey(entry) !== candidateId);
      if (!champion || !rival) return;
      setGuess(candidateId);
      const opponents = queueOpponents(champion, rival);
      setAnimating(true);
      const matches = [];
      let championWins = true;
      let finalLoser = rival;
      for (const opponent of opponents) {
        const outcome = simulateDuel(champion, opponent, characterMap, dateKey);
        matches.push({ opponent, outcome });
        if (sameEntity(outcome.winner, champion)) {
          finalLoser = opponent;
          continue;
        }
        championWins = false;
        finalLoser = champion;
        break;
      }
      const finalMatch = matches[matches.length - 1] || null;
      const finalWinner = championWins
        ? champion
        : finalMatch?.outcome?.winner && sameEntity(finalMatch.outcome.winner, champion)
        ? champion
        : finalMatch?.outcome?.winner || finalLoser;
      setResult({
        champion,
        matches,
        championWins,
        finalWinner,
        finalLoser,
        mode,
        roundLogs: finalMatch?.outcome?.logs || [],
      });
      setMessage(championWins ? `${champion.name} Wins` : `${champion.name} Loses`);
      setRevealedRounds(0);
      setShowSummary(false);
      setTimeout(() => setAnimating(false), 1200);
    },
    [pair, result, animating, queueOpponents, mode, characterMap, dateKey]
  );

  const rematch = useCallback(() => {
    setGuess(null);
    setResult(null);
    setMessage(null);
    setAnimating(false);
    setRevealedRounds(0);
    setShowSummary(false);
  }, []);

  const nextOpponents = useCallback(() => {
    shufflePair();
  }, [shufflePair]);

  if (!contenders.length || pair.length < 2) {
    return null;
  }

  const [left, right] = pair;
  const lastMatch = result?.matches?.[result.matches.length - 1] || null;
  const roundLogs = result?.roundLogs || [];
  const championName = result?.champion?.name || left?.name;
  const challengerName = lastMatch?.opponent?.name || right?.name;

  useEffect(() => {
    if (!roundLogs.length || !result) {
      setRevealedRounds(0);
      setShowSummary(false);
      return undefined;
    }
    setRevealedRounds(0);
    setShowSummary(false);
    const timers = [];
    roundLogs.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setRevealedRounds(index + 1);
          if (index + 1 === roundLogs.length) {
            setTimeout(() => setShowSummary(true), 350);
          }
        }, (index + 1) * 420)
      );
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [roundLogs, result]);

  const summaryBar = (
    <div
      role="button"
      tabIndex={0}
      onClick={toggleExpanded}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleExpanded();
        }
      }}
      className="group flex w-full items-center justify-between gap-3 rounded-full border border-white/12 bg-black/40 px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.35em] text-white/70 transition hover:border-amber-300/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
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
    </div>
  );

  const fighterCard = (fighter, slotIndex = 0) => {
    if (!fighter) return null;
    const key = entityKey(fighter);
    const descriptor = entityDescriptor(fighter);
    const collage = fighter.type === "faction" ? collageSourcesForEntry(fighter) : null;
    const imageSources = fighter.type === "faction" ? collage : [fighter.cover, ...(fighter.gallery || [])].filter(Boolean);
    const portraitIndex = portraitStep[key] ?? 0;
    const portrait = imageSources.length ? imageSources[portraitIndex % imageSources.length] : fighter.cover;
    const isWinner = result && sameEntity(result.finalWinner, fighter);
    const isLoser = result && sameEntity(result.finalLoser, fighter);
    const isChosen = guess === key;
    const jitterClass = animating ? (slotIndex % 2 === 0 ? "animate-duel-shake-left" : "animate-duel-shake-right") : "";
    const handleSelect = () => {
      if (result) return;
      choose(key);
    };
    const handleKey = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSelect();
      }
    };
    return (
      <div
        key={key}
        role="button"
        tabIndex={0}
        onClick={handleSelect}
        onKeyDown={handleKey}
        className={classNames(
          "relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/12 bg-black/40 backdrop-blur-xl transition",
          jitterClass,
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
          {fighter.type === "faction" ? (
            <FactionCollage sources={collage?.length ? collage : imageSources} />
          ) : (
            <ImageSafe
              src={portrait || fighter.cover || fighter.gallery?.[0]}
              alt={characterAltText(fighter.name)}
              fallbackLabel={fighter.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
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
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
              {mode === "duel" ? "Single clash" : `Championship • ${championshipSlots}`}
            </span>
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
        {isLoser && <div className="pointer-events-none absolute inset-0 bg-black/55" aria-hidden="true" />}
      </div>
    );
  };

  if (!expanded) {
    return <section className="rounded-3xl border border-white/12 bg-white/5 p-2 backdrop-blur-2xl">{summaryBar}</section>;
  }

  return (
    <section className="space-y-6 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">Predict the victor</h2>
          <p className="text-sm font-semibold text-white/70">
            Call the duel, or stage a championship run across three or four challengers. Every guess shapes your legend.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 p-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/70">
            <button
              type="button"
              onClick={nextOpponents}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white transition hover:bg-white/20"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reload
            </button>
            <button
              type="button"
              onClick={() => setBattleMode("duel")}
              className={classNames(
                "rounded-full px-3 py-1 transition",
                !isChampionship ? "bg-amber-300/20 text-amber-100" : "text-white/60 hover:text-white"
              )}
            >
              Duel
            </button>
            <button
              type="button"
              onClick={toggleChampionship}
              className={classNames(
                "rounded-full px-3 py-1 transition",
                isChampionship ? "bg-amber-300/20 text-amber-100" : "text-white/60 hover:text-white"
              )}
            >
              Championship
            </button>
          </div>
          {isChampionship && (
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/70">
              <span className="hidden text-white/60 sm:inline">Legends</span>
              {[3, 4].map((slots) => (
                <button
                  key={slots}
                  type="button"
                  onClick={() => selectChampionshipSlots(slots)}
                  className={classNames(
                    "rounded-full px-3 py-1 transition",
                    championshipSlots === slots ? "bg-amber-300/25 text-amber-100" : "text-white/60 hover:text-white"
                  )}
                >
                  {slots}
                </button>
              ))}
            </div>
          )}
          {summaryBar}
        </div>
      </div>
      <div className="relative">
        <div className="grid grid-cols-2 gap-4">
          {fighterCard(left, 0)}
          {fighterCard(right, 1)}
        </div>
        {animating && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-amber-300/60 bg-black/70 p-4 shadow-[0_0_60px_rgba(251,191,36,0.35)]">
              <Swords className="h-10 w-10 text-amber-200 animate-duel-swords" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
      {roundLogs.length > 0 && championName && challengerName && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/75">
          {roundLogs.slice(0, revealedRounds).map((log) => (
            <div key={log.swing} className="rounded-full border border-white/20 bg-black/70 px-4 py-1">
              Round {log.swing}: {championName?.split(" ")[0]} {log.h1} • {challengerName?.split(" ")[0]} {log.h2}
            </div>
          ))}
        </div>
      )}
      {result && showSummary && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.3em]">
          <button
            type="button"
            onClick={rematch}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white transition hover:bg-white/20"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={nextOpponents}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white transition hover:bg-white/20"
          >
            New duel
          </button>
          <button
            type="button"
            onClick={() => selectChampionshipSlots(championshipSlots === 4 ? 3 : 4)}
            className="rounded-full border border-amber-300/50 bg-amber-300/15 px-4 py-2 text-amber-100 transition hover:bg-amber-300/25"
          >
            Adjust lineup
          </button>
        </div>
      )}
      {result && showSummary && (
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
  dayKey,
}) {
  const dateKey = dayKey || new Date().toISOString().slice(0, 10);
  const characterMap = useMemo(() => {
    const map = new Map();
    (characters || []).forEach((character) => {
      if (!character) return;
      const key = character.id || character.slug;
      if (key) map.set(key, character);
    });
    return map;
  }, [characters]);
  const preparedEntries = useMemo(
    () =>
      (entries || []).map((entry) => ({
        ...entry,
        collage: collageSourcesForEntry(entry),
        visualMetrics: buildVisualMetrics(entry, characterMap, dateKey),
        combatProfile: entry.type === "faction" ? computeFactionStats(entry, characterMap, dateKey) : null,
      })),
    [entries, characterMap, dateKey]
  );
  const slides = useMemo(() => normaliseSlides(preparedEntries), [preparedEntries]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const guessRoster = useMemo(() => {
    if (basePath === "/factions") return preparedEntries;
    if (characters && characters.length) return characters;
    return preparedEntries.flatMap((entry) => entry.members || []);
  }, [characters, preparedEntries, basePath]);

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
    preparedEntries.reduce((acc, entry) => acc || firstMemberPortrait(entry.members || []), null) ||
    null;
  const heroMembers = useMemo(() => {
    if (!current) return [];
    return sampleMembers(current.members || [], 6);
  }, [current?.slug]);
  const [heroHighlight, setHeroHighlight] = useState(null);
  useEffect(() => {
    if (!heroMembers.length) {
      setHeroHighlight(null);
      return;
    }
    const firstKey = entityKey(heroMembers[0]);
    setHeroHighlight((prev) => {
      if (prev && heroMembers.some((member) => entityKey(member) === prev)) {
        return prev;
      }
      return firstKey || null;
    });
  }, [current?.slug, heroMembers]);
  const activeHero = useMemo(() => {
    if (!heroMembers.length) return null;
    if (heroHighlight) {
      const match = heroMembers.find((member) => entityKey(member) === heroHighlight);
      if (match) return match;
    }
    return heroMembers[0];
  }, [heroMembers, heroHighlight]);
  const activeQuote =
    activeHero?.shortDesc ||
    activeHero?.summary ||
    (current?.snippets && current.snippets[0]) ||
    current?.summary ||
    description;
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
              {!heroMembers.length && (
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
                      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                    >
                      <div className="space-y-4">
                        {heroMembers.length ? (
                          <HeroRosterGrid
                            members={heroMembers}
                            activeId={heroHighlight}
                            onHighlight={(id) => {
                              if (id) setHeroHighlight(id);
                            }}
                          />
                        ) : (
                          <div className="rounded-3xl border border-white/12 bg-white/5 p-4 text-sm font-semibold text-white/70">
                            The archives are preparing illustrated legends for this focus.
                          </div>
                        )}
                        <div className="rounded-3xl border border-white/12 bg-black/40 p-5 text-sm font-semibold text-white/80">
                          <p className="text-base font-semibold text-white/85 sm:text-lg">“{activeQuote}”</p>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[0.65rem] uppercase tracking-[0.3em] text-white/60">
                            <span>— {activeHero?.name || current?.name}</span>
                            {activeHero?.slug && (
                              <Link
                                href={`/characters/${activeHero.slug}`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-white transition hover:bg-white/20"
                              >
                                View profile
                              </Link>
                            )}
                          </div>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                          Hover or tap portraits to reveal whispers from the dossier.
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-[0_12px_40px_rgba(8,10,26,0.55)]">
                          {current.collage?.length ? (
                            <FactionCollage sources={current.collage} />
                          ) : current.primaryImage ? (
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
        {enableArena && preparedEntries.length > 1 && (
          <FactionArena entries={preparedEntries} basePath={basePath} characterMap={characterMap} dayKey={dateKey} />
        )}
        {enableArena && (
          <GuessTheVictorSection
            roster={guessRoster}
            characterMap={characterMap}
            dayKey={dateKey}
            contextType={basePath === "/factions" ? "faction" : "character"}
          />
        )}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-black text-white">Archive dossiers</h2>
            <span className="text-sm font-semibold text-white/60">
              {preparedEntries.length} dossier{preparedEntries.length === 1 ? "" : "s"} documented
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {preparedEntries.map((entry) => (
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
                {entry.visualMetrics?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {entry.visualMetrics.slice(0, 3).map((metric) =>
                      metric.type === "bar" ? (
                        <div key={metric.key} className="space-y-1">
                          <div className="flex items-center justify-between text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/55">
                            <span>{metric.label}</span>
                            <span>{Math.round(metric.value)}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500"
                              style={{ width: `${Math.min(100, Math.max(0, metric.value))}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div key={metric.key} className="flex items-center gap-3">
                          <div
                            className="h-12 w-12 rounded-full border border-white/15"
                            style={{
                              backgroundImage: `conic-gradient(rgba(250,204,21,0.9) ${Math.min(100, Math.max(0, metric.value)) * 3.6}deg, rgba(148,163,184,0.2) 0deg)`,
                            }}
                          />
                          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/65">
                            <div>{metric.label}</div>
                            <div className="text-white/80">{Math.round(metric.value)}%</div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
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

function FactionArena({ entries, basePath, characterMap, dayKey }) {
  const dateKey = dayKey || new Date().toISOString().slice(0, 10);
  const roster = useMemo(() => entries.filter((entry) => entry && entry.slug), [entries]);
  const [left, setLeft] = useState(() => roster[0] || null);
  const [right, setRight] = useState(() => roster[1] || roster[0] || null);
  const [result, setResult] = useState(null);

  const selectBySlug = useCallback((slug) => roster.find((entry) => entry.slug === slug) || null, [roster]);

  const statsFor = useCallback(
    (entry) => {
      if (!entry) return null;
      return entry.combatProfile || computeFactionStats(entry, characterMap, dateKey) || {
        strength: 40,
        power: 40,
        discipline: 40,
        mystique: 40,
        fortune: 50,
      };
    },
    [characterMap, dateKey]
  );

  const duelScore = useCallback(
    (entry) => {
      const stats = statsFor(entry);
      if (!stats) return 0;
      const base =
        stats.strength * 0.28 + stats.power * 0.32 + stats.discipline * 0.16 + stats.mystique * 0.14 + stats.fortune * 0.1;
      const swing = (Math.random() - 0.5) * 2; // -1..1
      const luck = Math.sign(swing) * Math.pow(Math.abs(swing), 0.45) * (stats.fortune / 100) * base * 0.65;
      return base + luck;
    },
    [statsFor]
  );

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
      const scoreLeft = duelScore(l);
      const scoreRight = duelScore(r);
      let winner;
      if (scoreLeft === scoreRight) {
        winner = Math.random() > 0.5 ? l : r;
      } else {
        winner = scoreLeft > scoreRight ? l : r;
      }
      const loser = winner === l ? r : l;
      const winnerStats = statsFor(winner);
      const loserStats = statsFor(loser);
      const advantage = Math.max(0, Math.round((scoreLeft - scoreRight) || (scoreRight - scoreLeft)));
      setResult({
        winner,
        loser,
        narrative: `${winner.name} marshal their forces with precision, overtaking ${loser.name} despite volatile fortunes.`,
        scores: { left: Math.round(scoreLeft), right: Math.round(scoreRight) },
        detail: { winnerStats, loserStats, advantage },
      });
    },
    [left, right, duelScore, statsFor]
  );

  const duel = useCallback(() => {
    resolveDuel();
  }, [resolveDuel]);

  const renderMetricRow = (metric) => {
    if (!metric) return null;
    if (metric.type === "bar") {
      return (
        <div key={metric.key} className="space-y-1">
          <div className="flex items-center justify-between text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/55">
            <span>{metric.label}</span>
            <span>{Math.round(metric.value)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500"
              style={{ width: `${Math.min(100, Math.max(0, metric.value))}%` }}
            />
          </div>
        </div>
      );
    }
    const percentage = Math.min(100, Math.max(0, metric.value));
    return (
      <div key={metric.key} className="flex items-center gap-3">
        <div
          className="h-12 w-12 rounded-full border border-white/15 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.85)_0%,rgba(17,24,39,0.2)_55%,rgba(17,24,39,0.8)_100%)]"
          style={{ backgroundImage: `conic-gradient(rgba(250,204,21,0.9) ${percentage * 3.6}deg, rgba(148,163,184,0.2) 0deg)` }}
        />
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/65">
          <div>{metric.label}</div>
          <div className="text-white/80">{Math.round(metric.value)}%</div>
        </div>
      </div>
    );
  };

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
              {value.collage?.length ? (
                <FactionCollage sources={value.collage} />
              ) : value.primaryImage ? (
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
          {value.visualMetrics?.length > 0 && <div className="space-y-2">{value.visualMetrics.map(renderMetricRow)}</div>}
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
          <div className="flex-1 space-y-4 rounded-3xl border border-amber-300/50 bg-amber-200/10 px-5 py-4 text-sm font-semibold text-amber-100">
            <div className="flex flex-wrap items-center justify-between gap-2 text-lg font-black uppercase tracking-[0.35em] text-amber-200">
              <span>{result.winner.name} prevail</span>
              <span>
                {result.scores.left} – {result.scores.right}
              </span>
            </div>
            <p className="text-sm text-amber-100">{result.narrative}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[result.winner, result.loser].map((team) => {
                const isWinner = sameEntity(team, result.winner);
                const detail = result.detail || {};
                const stats = isWinner ? detail.winnerStats : detail.loserStats;
                const metrics = stats || { strength: 0, power: 0, discipline: 0, mystique: 0, fortune: 0 };
                return (
                  <div
                    key={team.slug}
                    className={classNames(
                      "space-y-2 rounded-2xl border px-4 py-3",
                      isWinner ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/20 bg-black/20"
                    )}
                    >
                      <div className="text-sm font-black uppercase tracking-[0.3em] text-white/80">{team.name}</div>
                      <div className="grid gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/60">
                        <span>Strength {Math.round(metrics.strength)}</span>
                        <span>Power {Math.round(metrics.power)}</span>
                        <span>Discipline {Math.round(metrics.discipline)}</span>
                        <span>Mystique {Math.round(metrics.mystique)}</span>
                        <span>Fortune {Math.round(metrics.fortune)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
