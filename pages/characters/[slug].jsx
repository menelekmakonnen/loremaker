import Head from "next/head";
import Link from "next/link";
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

export default function CharacterProfilePage({ character, canonicalUrl, related, schemaJson }) {
  if (!character) {
    return null;
  }
  const metaDescription = formatDescription(character);
  const heroImage = character.cover || character.gallery?.[0] || null;
  const galleryImages = character.gallery?.length ? character.gallery : heroImage ? [heroImage] : [];
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

            {!!galleryImages.length && (
              <section>
                <h2 className="text-2xl font-black text-white">Gallery</h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  {galleryImages.map((image, index) => (
                    <div key={`${image}-${index}`} className="overflow-hidden rounded-3xl border border-white/15">
                      <img
                        src={image}
                        alt={`${character.name} artwork ${index + 1} from the LoreMaker Universe`}
                        className="h-full w-full object-cover"
                        loading={index < 2 ? "lazy" : "lazy"}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        decoding="async"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

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
  return fallbackCharacters.map((character) => sanitizeCharacter(character)).filter(Boolean);
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
