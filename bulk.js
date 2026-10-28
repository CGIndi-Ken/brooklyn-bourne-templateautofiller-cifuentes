// One product per line. Optional tab-separated Strain and Online description.
function buildBulkTemplates(text, shared, existing) {
  const templates = { ...existing };
  const created = [];
  const skipped = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const columns = line.split("\t").map((value) => value.trim());
    if (columns.length > 3 || !columns[0]) throw new Error(`Line ${index + 1}: use Name, optional Strain, optional Description separated by tabs.`);
    const [name, strain = "", onlineDescription = ""] = columns;
    if (onlineDescription.length > 2500) throw new Error(`Line ${index + 1}: description exceeds 2500 characters.`);
    if (Object.hasOwn(templates, name)) { skipped.push(name); continue; }
    // These are product-specific and must not leak from the shared template.
    const data = { ...shared, ...NEW_TEMPLATE_DEFAULTS, name, strain, onlineDescription, externalId: "", gramsConcentration:gramsFromTitle(name), inferGramsFromTitle:true };
    applyTemplatePreset(data);
    delete data.type;
    delete data.defaultUnit;
    Object.defineProperty(templates, name, {value:data, enumerable:true, writable:true, configurable:true});
    created.push(name);
  }
  return { templates, created, skipped };
}
