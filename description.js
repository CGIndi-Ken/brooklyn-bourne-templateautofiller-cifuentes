// Manual research prompt only: no requests to ChatGPT or strain websites are sent here.
function strainFromTitle(title) {
  title = title.trim();
  const types = { S: "Sativa", H: "Hybrid", I: "Indica", IH: "Indica-dominant hybrid", SH: "Sativa-dominant hybrid" };
  const match = title.match(/\((S|H|I|I\s*\/?\s*H|S\s*\/?\s*H)\)\s*$/i);
  if (!match) throw new Error("End Name with a strain type: (S), (H), (I), (I/H), or (S/H).");
  const parts = title.slice(0, match.index).split("|").map((s) => s.trim());
  let strain;
  if (parts.length >= 3) strain = parts[parts.length - 2];
  else if (parts.length === 2 && /\d\s*(g|mg|oz)\b/i.test(parts[1])) strain = parts[0];
  else if (parts.length === 2) strain = parts[1];
  else strain = parts[0];
  if (!strain) throw new Error("Enter a strain name, for example: Product name | Runtz | 3.5g (H).");
  const key = match[1].replace(/[\s/]/g, "").toUpperCase();
  const code = { IH: "I/H", SH: "S/H" }[key] || key;
  return { strain, type: types[key], code };
}

function descriptionPrompt(title) {
  const { strain, code } = strainFromTitle(title);
  return `${strain} (${code})`;
}
