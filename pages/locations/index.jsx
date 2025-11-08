import Head from "next/head";
import { loadCharacterLibrary, buildTaxonomies, todayKey } from "../../lib/characters";
import { TaxonomyIndexLayout } from "../../components/taxonomy-layout";

const META_TITLE = "Locations of the LoreMaker Universe | Menelek Makonnen";
const META_DESCRIPTION =
  "Tour the cities, sanctums, and hidden realms that anchor the LoreMaker Universe's greatest legends.";

export default function LocationsIndexPage({ entries, characters, dayKey }) {
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
        title="World Footprints"
        description="Discover the regions, fortresses, and mythic crossroads tied to heroes and villains across the LoreMaker Universe."
        entries={entries}
        basePath="/locations"
        characters={characters}
        dayKey={dayKey}
      />
    </>
  );
}

export async function getStaticProps() {
  const characters = await loadCharacterLibrary();
  const { locations } = buildTaxonomies(characters);

  return {
    props: {
      entries: locations,
      characters,
      dayKey: todayKey(),
    },
    revalidate: 600,
  };
}
