import Head from "next/head";
import { loadCharacterLibrary, buildTaxonomies, todayKey } from "../../lib/characters";
import { TaxonomyIndexLayout } from "../../components/taxonomy-layout";

const META_TITLE = "Timelines of the LoreMaker Universe | Menelek Makonnen";
const META_DESCRIPTION =
  "Chart the eras and mythic ages that shape the LoreMaker Universe's evolving history.";

export default function TimelinesIndexPage({ entries, characters, dayKey }) {
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
        title="Era Timelines"
        description="Trace the epochs — from ancient pantheons to emerging futures — that connect heroes across Menelek Makonnen's LoreMaker Universe."
        entries={entries}
        basePath="/timelines"
        characters={characters}
        dayKey={dayKey}
      />
    </>
  );
}

export async function getStaticProps() {
  const characters = await loadCharacterLibrary();
  const { timelines } = buildTaxonomies(characters);

  return {
    props: {
      entries: timelines,
      characters,
      dayKey: todayKey(),
    },
    revalidate: 600,
  };
}
