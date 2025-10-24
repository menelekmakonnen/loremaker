import { fetchCharactersFromSheets, isCharactersConfigError, publicCharactersError } from "../../lib/characters";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const data = await fetchCharactersFromSheets({ force });
    res.status(200).json({ data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const status = isCharactersConfigError(error) ? 503 : 500;
    res.status(status).json({ error: publicCharactersError(error) });
  }
}
