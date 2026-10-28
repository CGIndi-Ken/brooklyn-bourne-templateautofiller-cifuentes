// Shared flat-color themes for the popup and isolated on-page panel.
const AUTOFILL_PALETTES = {
  "black-gold": { label: "Black and gold", surface: "#101010", input: "#0b0b0a", head: "#0c0c0c", bar: "#111110", foot: "#10100f", card: "#121210", note: "#141411", accent: "#dfbc6c", text: "#f5f1e8", muted: "#b9b3a6", line: "#393326", edge: "#655332", soft: "#ead7a9", tint: "#17150f", top: "#26231b", hover: "#30291c", buttonTop: "#27241e", buttonBottom: "#191815", buttonHoverBottom: "#252017", labelColor: "#d7d0c0", placeholder: "#8e897e", ink: "#201808", primary: "#dfbc6c" },
  "black-yellow": { label: "Black and yellow", surface: "#101010", input: "#090909", head: "#090909", bar: "#121210", foot: "#10100e", card: "#15150f", note: "#17170e", accent: "#ffe24a", text: "#f8f7eb", muted: "#c0bea8", line: "#3f3d23", edge: "#71672d", soft: "#f9e999", tint: "#24220e", top: "#2b2918", hover: "#37321b", buttonTop: "#2b291c", buttonBottom: "#1c1b12", buttonHoverBottom: "#2b2712", labelColor: "#e1dfca", placeholder: "#99967c", ink: "#211d03", primary: "#ffe24a" },
  "grey-maroon": { label: "Grey and maroon", surface: "#28282c", input: "#202024", head: "#232327", bar: "#2b2a30", foot: "#25252a", card: "#303035", note: "#303036", accent: "#e0a4b5", text: "#faf3f5", muted: "#c6bac1", line: "#57434c", edge: "#886070", soft: "#f0c7d2", tint: "#3c2833", top: "#49313c", hover: "#563541", buttonTop: "#43343d", buttonBottom: "#332c33", buttonHoverBottom: "#42303b", labelColor: "#e4d5dd", placeholder: "#b1a0aa", ink: "#fff5f7", primary: "#762944" },
  "forest-mint": { label: "Forest green and mint green", surface: "#10271e", input: "#0b1d16", head: "#0c2119", bar: "#133023", foot: "#10281e", card: "#173326", note: "#19382b", accent: "#a0e5bf", text: "#effbf3", muted: "#b1cbbb", line: "#365a46", edge: "#54876b", soft: "#c5f2d8", tint: "#193d2c", top: "#294f3b", hover: "#345f48", buttonTop: "#2a4938", buttonBottom: "#1b3327", buttonHoverBottom: "#254734", labelColor: "#d2e8db", placeholder: "#8fab99", ink: "#0d2b1b", primary: "#a0e5bf" },
};
const DEFAULT_AUTOFILL_THEME = "black-gold";
function paletteVariables(p) {
  return Object.entries({
    "--surface": p.surface, "--input": p.input,
    "--gold": p.accent, "--line": p.line, "--text": p.text, "--muted": p.muted, "--primary": p.primary,
    "--head-bg": p.head, "--bar-bg": p.bar, "--foot-bg": p.foot, "--card-bg": p.card, "--note-bg": p.note,
    "--edge": p.edge, "--soft": p.soft, "--tint": p.tint, "--section-top": p.top,
    "--section-hover": p.hover, "--button-top": p.buttonTop, "--button-bottom": p.buttonBottom,
    "--button-hover-bottom": p.buttonHoverBottom,
    "--label-color": p.labelColor, "--placeholder": p.placeholder, "--accent-ink": p.ink,
  }).map(([key, value]) => `${key}:${value};`).join("\n");
}

function initThemeSelector(select, root) {
  for (const [id, theme] of Object.entries(AUTOFILL_PALETTES)) select.add(new Option(theme.label, id));
  let changed = false;
  const apply = (id) => {
    const theme = Object.hasOwn(AUTOFILL_PALETTES, id) ? id : DEFAULT_AUTOFILL_THEME;
    root.setAttribute("data-autofill-theme", theme);
    select.value = theme;
  };
  apply(DEFAULT_AUTOFILL_THEME);
  chrome.storage.local.get("theme").then(({theme}) => { if (!changed) apply(theme); }).catch(() => {});
  select.addEventListener("change", async () => {
    changed = true;
    apply(select.value);
    try {
      await chrome.storage.local.set({theme:select.value});
      select.title = "";
    } catch (e) { select.title = "Theme changed, but could not be saved. Try selecting it again."; }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (changes.theme && area === "local") { changed = true; apply(changes.theme.newValue); }
  });
}
const AUTOFILL_THEME = `
  :root, :host {
    color-scheme: dark;
    ${paletteVariables(AUTOFILL_PALETTES[DEFAULT_AUTOFILL_THEME])}
  }
  ${Object.entries(AUTOFILL_PALETTES).map(([id, p]) => `:root[data-autofill-theme="${id}"], :host([data-autofill-theme="${id}"]) { ${paletteVariables(p)} }`).join("\n")}
  * { box-sizing: border-box; }
  [hidden] { display:none !important; }
  button, input, select, textarea, summary { font:inherit; }
  button, input, select, textarea { border-radius:6px; }
  button { cursor:pointer; font-weight:700; padding:8px 11px; color:var(--text);
    border:1px solid var(--edge); background:var(--button-bottom);
    transition:background-color .12s,border-color .12s; }
  button:hover:not(:disabled) { border-color:var(--gold); background:var(--button-hover-bottom); }
  button:active:not(:disabled) { background:var(--button-top); }
  button:disabled { cursor:default; opacity:.5; }
  input, select, textarea { width:100%; padding:9px 10px; color:var(--text); background:var(--input); border:1px solid var(--line); }
  input::placeholder, textarea::placeholder { color:var(--placeholder); opacity:1; }
  select option { background:var(--input); color:var(--text); }
  input:disabled, select:disabled { opacity:1; color:var(--soft); background:var(--tint); border-color:var(--edge); }
  textarea { resize:vertical; line-height:1.6; }
  input:focus, select:focus, textarea:focus, button:focus-visible, summary:focus-visible {
    outline:2px solid var(--gold); outline-offset:2px; }
  .stripe { height:4px; background:var(--primary); }
  .gold-button { color:var(--accent-ink); background:var(--primary); border:1px solid var(--primary); font-weight:800; }
  .gold-button:hover:not(:disabled) { color:var(--accent-ink); background:var(--primary); border-color:var(--text); }
  .head { background:var(--head-bg); }
  .brand { display:block; color:var(--gold); font-weight:800; letter-spacing:-.3px; }
  .brand-sub { display:block; margin-top:5px; color:var(--soft); font-size:10px; font-weight:600; letter-spacing:2.4px; text-transform:uppercase; }
  @media (prefers-reduced-motion:reduce) { * { transition:none !important; } }
`;
const AUTOFILL_LAYOUT = `

    .app-surface { width:440px; margin:0; color:var(--text); background-color:var(--surface);
      font:13px/1.5 "Segoe UI",Arial,sans-serif; }
    .head { padding:22px 20px 20px; }
    .brand { font-size:24px; line-height:1.15; }
    .bar { position:sticky; top:0; z-index:2; padding:14px 18px; background:var(--bar-bg);
      border-bottom:1px solid var(--line); }
    .bar .line { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
    .popup-view-tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; padding:12px 16px; border-bottom:1px solid var(--line); }
    .popup-view-tabs button { padding:9px 5px; font-size:11px; }
    .popup-view-tabs [aria-pressed="true"] { color:var(--gold); border-color:var(--gold); background:var(--tint); }
    #bulkWorkspace, #directoryWorkspace { display:block; width:100%; height:660px; border:0; background:var(--surface); }
    .bar select { grid-column:1/-1; }
    .bar input { margin-top:9px; }
    .theme-picker { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
    .theme-picker label { margin:0; flex:0 0 auto; color:var(--muted); }
    .theme-picker select { min-width:0; flex:1; font-size:12px; }
    #form, .body { padding:2px 16px 14px; }
    .card { margin-top:13px; border:1px solid var(--line); border-radius:10px; overflow:hidden;
      background:var(--card-bg); }
    .card summary, .card .section-heading { display:flex; align-items:center; justify-content:space-between; cursor:pointer;
      list-style:none; padding:13px 14px; background:var(--section-top); font-weight:750; color:var(--soft); }
    .card summary:hover { background:var(--section-hover); }
    .card summary::-webkit-details-marker { display:none; }
    .card summary::after { content:"+"; margin-left:12px; font-size:17px; color:var(--gold); font-weight:400; }
    .card[open] summary::after { content:"\\2212"; }
    .count { margin-left:auto; padding:2px 9px; border:1px solid var(--edge); border-radius:20px;
      font-size:10px; font-weight:650; color:var(--gold); background:var(--tint); }
    .fields { padding:4px 14px 16px; }
    .field { margin-top:13px; }
    .preset-lock-row { margin-top:8px; }
    .preset-lock-row .check { margin-top:0; }
    .preset-lock-row .sub { margin:4px 0 0 23px; }
    label { display:block; margin-bottom:5px; font-size:12px; color:var(--label-color); font-weight:600; }
    .req { color:var(--gold); }
    .pair { display:flex; gap:7px; }
    .pair select:not(:only-child) { flex:0 0 88px; width:88px; }
    .pair > * { min-width:0; }
    .money { display:flex; width:100%; }
    .money span { display:flex; align-items:center; padding:8px 12px; color:var(--gold); background:var(--tint);
      border:1px solid var(--edge); border-right:0; border-radius:8px 0 0 8px; }
    .money input { border-radius:0 8px 8px 0; }
    .foot { position:sticky; bottom:0; z-index:2; display:flex; align-items:center; gap:14px;
      padding:14px 18px; background:var(--foot-bg); border-top:1px solid var(--edge); }
    #saveBtn { padding:11px 20px; font-size:14px; }
    #toast { color:var(--gold); font-size:12px; min-height:1em; overflow-wrap:anywhere; }
    .check { display:flex; gap:9px; align-items:flex-start; font-size:12px; margin-top:12px; line-height:1.6; }
    .check input { width:auto; margin-top:4px; accent-color:var(--gold); }
    .sub { margin:9px 0; font-size:11px; line-height:1.65; color:var(--muted); }
    .note { margin:10px 16px 14px; padding:12px 14px; border:1px solid var(--line); border-radius:10px;
      background:var(--note-bg); color:var(--muted); font-size:11px; line-height:1.65; }
    #descriptionPrompt { margin-top:9px; }
    #descriptionCount { text-align:right; }
    #bulkStatus, #transferStatus { color:var(--soft); margin-top:9px; overflow-wrap:anywhere; }
    #bulkStatus { max-height:180px; overflow:auto; }
    #bulkPreviewBtn, #bulkCreateBtn { margin-top:5px; }
    ::-webkit-scrollbar { width:7px; height:7px; }
    ::-webkit-scrollbar-thumb { background:var(--edge); border-radius:10px; }
    ::-webkit-scrollbar-track { background:var(--input); }

  .help {margin:8px 0;font-size:11px;color:var(--muted);line-height:1.6;}
  .help > summary,.card .help > summary {display:list-item;list-style:none;cursor:pointer;padding:5px 0;background:transparent;color:var(--muted);font-size:11px;font-weight:500;}
  .help > summary::before {content:"▸ ";}
  .help[open] > summary::before {content:"▾ ";}
  .card .help > summary::after {content:none;}
  .help p {margin:7px 0;}
  .weight-from-name {font-size:10px;padding:4px 7px;margin-top:5px;font-weight:500;}
`;
