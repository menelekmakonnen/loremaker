import Head from "next/head";
import { loadCharacterLibrary, buildTaxonomies, todayKey } from "../../lib/characters";
import { TaxonomyIndexLayout } from "../../components/taxonomy-layout";

const META_TITLE = "Factions of the LoreMaker Universe | Menelek Makonnen";
const META_DESCRIPTION =
  "Explore the alliances, teams, and secret societies that shape Menelek Makonnen's LoreMaker Universe.";

export default function FactionsIndexPage({ entries, characters, dayKey }) {
  return (
    <>
      <Head>
        <title>{META_TITLE}</title>
        <meta name="description" content={META_DESCRIPTION} />
        <meta property="og:title" content={META_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={META_TITLE} />
        <meta name="twitter:description" content={META_DESCRIPTION} />
      </Head>
      <TaxonomyIndexLayout
        title="Factions & Teams"
        description="Meet the alliances who command territories, uphold ancient vows, and influence the cosmic balance of the LoreMaker Universe."
        entries={entries}
        basePath="/factions"
        enableArena
        characters={characters}
        dayKey={dayKey}
      />
    </>
  );
}

export async function getStaticProps() {
  const characters = await loadCharacterLibrary();
  const { factions } = buildTaxonomies(characters);

  return {
    props: {
      entries: factions,
      characters,
      dayKey: todayKey(),
    },
    revalidate: 600,
  };
}
