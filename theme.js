// Shared palettes for every editor and the isolated on-page panel.
const AUTOFILL_PALETTES = {
  "black-gold": { label: "Black and gold", surface: "#111113", input: "#121315", head: "#18191c", bar: "#151618", foot: "#18191c", card: "#202124", note: "#242529", accent: "#eccb88", text: "#f7f3eb", muted: "#c5c0b6", line: "#46433b", edge: "#716755", soft: "#f1dcb3", tint: "#332d22", top: "#2c2b27", hover: "#3b372d", buttonTop: "#413d33", buttonBottom: "#2e2d29", buttonHoverBottom: "#3e392f", labelColor: "#e5e1d8", placeholder: "#a9a398", ink: "#211a0d", primary: "#eccb88", primaryHover: "#f4dba7" },
  "black-yellow": { label: "Black and yellow", surface: "#111111", input: "#141414", head: "#191919", bar: "#151515", foot: "#191919", card: "#222221", note: "#272722", accent: "#f4e05c", text: "#faf9ee", muted: "#c8c7b8", line: "#46463b", edge: "#70705c", soft: "#f6edac", tint: "#34321f", top: "#303025", hover: "#40402c", buttonTop: "#434333", buttonBottom: "#30302a", buttonHoverBottom: "#3e3e2e", labelColor: "#e5e6d9", placeholder: "#a7aa94", ink: "#222207", primary: "#f4e05c", primaryHover: "#fff09a" },
  "grey-maroon": { label: "Grey and maroon", surface: "#202127", input: "#22232b", head: "#292a33", bar: "#25262e", foot: "#292a33", card: "#30313c", note: "#353541", accent: "#f1b8cb", text: "#fbf5f7", muted: "#c5bfce", line: "#575362", edge: "#7b7083", soft: "#f5d5e0", tint: "#4b3040", top: "#47313f", hover: "#583b4e", buttonTop: "#50424f", buttonBottom: "#3b3543", buttonHoverBottom: "#4c4052", labelColor: "#e5deeb", placeholder: "#b8adbf", ink: "#fff6f9", primary: "#8e3457", primaryHover: "#a13b63" },
  "forest-mint": { label: "Forest and mint", surface: "#0a1c19", input: "#0d241f", head: "#102b25", bar: "#0e251f", foot: "#102b25", card: "#15352d", note: "#193b33", accent: "#b0f0d2", text: "#f1fbf5", muted: "#b1cec2", line: "#365d50", edge: "#568773", soft: "#d5f5e5", tint: "#244c3e", top: "#20473a", hover: "#2c5948", buttonTop: "#315a49", buttonBottom: "#234637", buttonHoverBottom: "#305b47", labelColor: "#d6eade", placeholder: "#9bbcac", ink: "#102b20", primary: "#b0f0d2", primaryHover: "#d0f9e7" },
};
// Migrate former solid/legacy choices to their corresponding patterned palette.
const THEME_ALIASES = Object.fromEntries(Object.keys(AUTOFILL_PALETTES).flatMap(id => [[id,`${id}-deluxe-v2`],[`${id}-deluxe`,`${id}-deluxe-v2`]]));
const DELUXE_PATTERNS = {
  "black-gold": "repeating-linear-gradient(135deg, #eccb8809 0 1px, transparent 1px 14px)",
  "black-yellow": "radial-gradient(circle at 1px 1px, #f4e05c16 1px, transparent 1.2px)",
  "grey-maroon": "repeating-linear-gradient(45deg, #f1b8cb09 0 1px, transparent 1px 16px)",
  "forest-mint": "repeating-linear-gradient(45deg, #b0f0d209 0 1px, transparent 1px 20px), repeating-linear-gradient(135deg, #b0f0d207 0 1px, transparent 1px 20px)",
};
for (const [id, palette] of Object.entries(AUTOFILL_PALETTES)) {
  AUTOFILL_PALETTES[`${id}-deluxe-v2`] = {...palette, deluxe:true, pattern:DELUXE_PATTERNS[id]};
}
Object.assign(AUTOFILL_PALETTES, {
  "ember-copper": {label:"Ember and copper",deluxe:true,
    surface:"#19110f",input:"#211714",head:"#291a16",bar:"#211612",foot:"#291a16",card:"#30221c",note:"#372820",
    accent:"#f2ad7e",text:"#fff2e8",muted:"#d0b9a9",line:"#62493b",edge:"#956b50",soft:"#ffd7b8",tint:"#4a2d20",top:"#422b21",hover:"#583a29",
    buttonTop:"#64412c",buttonBottom:"#412d23",buttonHoverBottom:"#573b2c",labelColor:"#efdacc",placeholder:"#bfa590",ink:"#29170e",primary:"#f2ad7e",primaryHover:"#ffc99f",
    pattern:"radial-gradient(ellipse at 100% 0, #f2ad7e12, transparent 60%), repeating-linear-gradient(150deg, #f2ad7e07 0 1px, transparent 1px 28px)"},
  "espresso-cream": {label:"Espresso and cream",deluxe:true,
    surface:"#17130f",input:"#211c15",head:"#292217",bar:"#211b14",foot:"#292217",card:"#30281e",note:"#382f23",
    accent:"#e8cc9b",text:"#fff7e9",muted:"#cfc1a9",line:"#605343",edge:"#8e7a5c",soft:"#f6dfb9",tint:"#463824",top:"#403322",hover:"#54442e",
    buttonTop:"#5d4a32",buttonBottom:"#403425",buttonHoverBottom:"#53432f",labelColor:"#eadfc9",placeholder:"#bcad93",ink:"#251c11",primary:"#e8cc9b",primaryHover:"#f8e2bb",
    pattern:"radial-gradient(ellipse at 0 0, #e8cc9b10, transparent 65%), repeating-linear-gradient(90deg, #e8cc9b06 0 1px, transparent 1px 32px)"},
  "oxblood-rose": {label:"Oxblood and rose",deluxe:true,
    surface:"#1c1017",input:"#261720",head:"#321a27",bar:"#271720",foot:"#321a27",card:"#3a222e",note:"#412834",
    accent:"#f4a9bc",text:"#fff1f4",muted:"#d6b8c4",line:"#674452",edge:"#976277",soft:"#ffd2dd",tint:"#542837",top:"#4a2634",hover:"#603242",
    buttonTop:"#6a384a",buttonBottom:"#482735",buttonHoverBottom:"#5c3141",labelColor:"#efd5df",placeholder:"#c0a0ae",ink:"#30131e",primary:"#f4a9bc",primaryHover:"#ffc7d5",
    pattern:"radial-gradient(ellipse at 80% 0, #f4a9bc10, transparent 65%), repeating-linear-gradient(135deg, #f4a9bc07 0 1px, transparent 1px 24px)"},
  "midnight-ice": {label:"Midnight and ice",deluxe:true,
    surface:"#0d1725",input:"#122033",head:"#16283f",bar:"#122136",foot:"#16283f",card:"#1b304a",note:"#203751",
    accent:"#9ed9ff",text:"#eef8ff",muted:"#b6c9dd",line:"#395570",edge:"#567fa1",soft:"#d2ecff",tint:"#203f59",top:"#213b55",hover:"#2a4c6a",
    buttonTop:"#315a7d",buttonBottom:"#223e58",buttonHoverBottom:"#2d506e",labelColor:"#d1e3f4",placeholder:"#9bb4ce",ink:"#0c2335",primary:"#9ed9ff",primaryHover:"#c5ebff",
    pattern:"radial-gradient(ellipse at 50% 0, #9ed9ff12, transparent 65%), repeating-linear-gradient(0deg, #9ed9ff06 0 1px, transparent 1px 28px)"},
  "slate-lavender": {label:"Slate and lavender",deluxe:true,
    surface:"#171522",input:"#201d30",head:"#29243e",bar:"#211e31",foot:"#29243e",card:"#302a46",note:"#37304e",
    accent:"#cab7ff",text:"#f6f2ff",muted:"#c3bad7",line:"#524768",edge:"#7e6ca0",soft:"#e4d9ff",tint:"#42335d",top:"#3d3056",hover:"#51406d",
    buttonTop:"#5b477a",buttonBottom:"#3e3156",buttonHoverBottom:"#51406c",labelColor:"#e0d7f0",placeholder:"#aea0c6",ink:"#21152f",primary:"#cab7ff",primaryHover:"#e0d3ff",
    pattern:"radial-gradient(ellipse at 0 30%, #cab7ff10, transparent 65%), repeating-linear-gradient(45deg, #cab7ff07 0 1px, transparent 1px 30px), repeating-linear-gradient(135deg, #cab7ff04 0 1px, transparent 1px 30px)"},
  "teal-seafoam": {label:"Deep teal and seafoam",deluxe:true,
    surface:"#0c1c20",input:"#10272c",head:"#143139",bar:"#11292f",foot:"#143139",card:"#1a3a41",note:"#204249",
    accent:"#8fe3d2",text:"#edfffa",muted:"#b1cfcf",line:"#346067",edge:"#4f8a8e",soft:"#c7f7ec",tint:"#204b50",top:"#21464d",hover:"#2b5b60",
    buttonTop:"#31666a",buttonBottom:"#244a50",buttonHoverBottom:"#2c5b61",labelColor:"#cfe8e6",placeholder:"#94b7ba",ink:"#0b2a29",primary:"#8fe3d2",primaryHover:"#b9f4e7",
    pattern:"radial-gradient(ellipse at 100% 100%, #8fe3d212, transparent 65%), repeating-linear-gradient(160deg, #8fe3d207 0 1px, transparent 1px 26px)"},
});
for(const id of Object.keys(THEME_ALIASES)) delete AUTOFILL_PALETTES[id];
for(const [id,palette] of Object.entries(AUTOFILL_PALETTES)) AUTOFILL_PALETTES[`${id}-effects`]={...palette,effects:true};
const DEFAULT_AUTOFILL_THEME = "black-gold-deluxe-v2";
function paletteVariables(p) {
  return Object.entries({
    "--surface": p.surface, "--input": p.input,
    "--gold": p.accent, "--line": p.line, "--text": p.text, "--muted": p.muted, "--primary": p.primary,
    "--head-bg": p.head, "--bar-bg": p.bar, "--foot-bg": p.foot, "--card-bg": p.card, "--note-bg": p.note,
    "--edge": p.edge, "--soft": p.soft, "--tint": p.tint, "--section-top": p.top,
    "--section-hover": p.hover, "--button-top": p.buttonTop, "--button-bottom": p.buttonBottom,
    "--button-hover-bottom": p.buttonHoverBottom,
    "--label-color": p.labelColor, "--placeholder": p.placeholder, "--accent-ink": p.ink,
    "--primary-hover": p.primaryHover || p.primary,
    "--control-radius": "8px", "--card-radius": "14px",
    "--section-radius": "13px", "--panel-radius": "16px",
    "--card-shadow": "0 6px 18px #00000024",
    "--section-rule": "3px solid var(--gold)",
    "--stripe-height": "2px",
    "--surface-pattern": p.pattern || "none",
    "--pattern-size": p.deluxe && p.label.startsWith("Black and yellow") ? "18px 18px" : "auto",
    "--header-pattern": p.deluxe ? `linear-gradient(120deg, ${p.head}, ${p.tint})` : "none",
    "--section-pattern": p.deluxe ? `linear-gradient(110deg, ${p.top}, ${p.card})` : "none",
    "--effect-edge": p.effects ? `inset 0 1px 0 ${p.accent}30` : "none",
    "--effect-glow": p.effects ? `0 0 0 3px ${p.accent}18, 0 4px 16px #00000030` : "none",
  }).map(([key, value]) => `${key}:${value};`).join("\n");
}

function initThemeSelector(select, root) {
  for (const effects of [false, true]) {
    const group = document.createElement("optgroup");group.label = effects ? "Effects" : "Patterned";
    for (const [id, theme] of Object.entries(AUTOFILL_PALETTES)) if (!!theme.effects === effects) group.append(new Option(theme.label, id));
    select.append(group);
  }
  let changed = false;
  const apply = (id) => {
    const theme = Object.hasOwn(AUTOFILL_PALETTES, id) ? id : (Object.hasOwn(THEME_ALIASES, id) ? THEME_ALIASES[id] : DEFAULT_AUTOFILL_THEME);
    root.setAttribute("data-autofill-theme", theme);
    root.setAttribute("data-autofill-finish", AUTOFILL_PALETTES[theme].effects ? "effects" : "patterned");
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
  button, input, select, textarea { border-radius:var(--control-radius); }
  button { cursor:pointer; font-weight:700; padding:8px 11px; color:var(--text);
    border:1px solid var(--edge); background:var(--button-bottom);
    transition:background-color .12s,border-color .12s; }
  button:hover:not(:disabled) { border-color:var(--gold); background:var(--button-hover-bottom); }
  button:active:not(:disabled) { background:var(--button-top); }
  button:disabled { cursor:default; opacity:.5; }
  input, select, textarea { width:100%; padding:9px 10px; color:var(--text); background:var(--input); border:1px solid var(--line); }
  input::placeholder, textarea::placeholder { color:var(--placeholder); opacity:1; }
  select option, select optgroup { background:var(--input); color:var(--text); }
  input:disabled, select:disabled { opacity:1; color:var(--soft); background:var(--tint); border-color:var(--edge); }
  textarea { resize:vertical; line-height:1.6; }
  input:focus, select:focus, textarea:focus, button:focus-visible, summary:focus-visible {
    outline:2px solid var(--gold); outline-offset:2px; }
  .stripe { height:var(--stripe-height); background:var(--primary); }
  .gold-button { color:var(--accent-ink); background:var(--primary); border:1px solid var(--primary); font-weight:800; }
  .gold-button:hover:not(:disabled) { color:var(--accent-ink); background:var(--primary-hover); border-color:var(--text); }
  .head { background:var(--head-bg); }
  .brand { display:block; color:var(--gold); font-weight:800; letter-spacing:-.3px; }
  .brand-sub { display:block; margin-top:5px; color:var(--soft); font-size:10px; font-weight:600; letter-spacing:2.4px; text-transform:uppercase; }
  :root[data-autofill-finish] :is(.popup-view-tabs,.workspace-nav,.editor-tabs,.tabs) button:is([aria-pressed="true"],.on),
  :host([data-autofill-finish]) :is(.popup-view-tabs,.workspace-nav,.editor-tabs,.tabs) button:is([aria-pressed="true"],.on) {
    box-shadow:inset 0 -2px 0 var(--gold); color:var(--gold); border-color:var(--edge); background:var(--tint);
  }
  :root[data-autofill-finish] .head, :host([data-autofill-finish]) .head {
    border-bottom:1px solid var(--line);
  }
  :root[data-autofill-finish] .brand-sub, :host([data-autofill-finish]) .brand-sub {
    color:var(--muted); letter-spacing:2.8px;
  }
  :root[data-autofill-finish] :is(.app-surface, body.workspace), :host([data-autofill-finish]) .app-surface {
    background-image:var(--surface-pattern); background-size:var(--pattern-size);
  }
  :root[data-autofill-finish] :is(.head,.workspace-header), :host([data-autofill-finish]) .head {
    background-image:var(--header-pattern);
  }
  :root[data-autofill-finish] :is(.card > summary,.card > .section-heading,.entry-head),
  :host([data-autofill-finish]) :is(.card > summary,.card > .section-heading) {
    background-image:var(--section-pattern);
  }
  :root[data-autofill-finish="effects"] .card, :host([data-autofill-finish="effects"]) .card {
    box-shadow:var(--effect-edge), var(--card-shadow);
  }
  :root[data-autofill-finish="effects"] button, :host([data-autofill-finish="effects"]) button {
    transition:background-color .12s, border-color .12s, transform .12s, box-shadow .12s;
  }
  :root[data-autofill-finish="effects"] :is(input,textarea,select):focus,
  :host([data-autofill-finish="effects"]) :is(input,textarea,select):focus,
  :root[data-autofill-finish="effects"] button:focus-visible,
  :host([data-autofill-finish="effects"]) button:focus-visible { box-shadow:var(--effect-glow); }
  @media (hover:hover) and (pointer:fine) {
    :root[data-autofill-finish="effects"] button:hover:not(:disabled),
    :host([data-autofill-finish="effects"]) button:hover:not(:disabled) { transform:translateY(-1px);box-shadow:var(--effect-glow); }
  }
  @media (prefers-reduced-motion:reduce) {
    * { transition:none !important; }
    :root[data-autofill-finish="effects"] button, :host([data-autofill-finish="effects"]) button { transform:none !important; }
  }
`;
const AUTOFILL_LAYOUT = `

    .app-surface { width:440px; margin:0; color:var(--text); background-color:var(--surface);
      font:13px/1.5 "Segoe UI",Arial,sans-serif; }
    .head { padding:22px 20px 20px; }
    .brand { font-size:24px; line-height:1.15; }
    .bar { position:sticky; top:0; z-index:2; padding:14px 18px; background:var(--bar-bg);
      border-bottom:1px solid var(--line); }
    .bar .line { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
    .popup-view-tabs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; padding:12px 16px; border-bottom:1px solid var(--line); }
    .popup-view-tabs button { padding:9px 5px; font-size:11px; }
    .popup-view-tabs [aria-pressed="true"] { color:var(--gold); border-color:var(--gold); background:var(--tint); }
    #bulkWorkspace, #directoryWorkspace, #strainsWorkspace { display:block; width:100%; height:660px; border:0; background:var(--surface); }
    .bar select { grid-column:1/-1; }
    .bar input { margin-top:9px; }
    .theme-picker { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
    .theme-picker label { margin:0; flex:0 0 auto; color:var(--muted); }
    .theme-picker select { min-width:0; flex:1; font-size:12px; }
    #form, .body { padding:2px 16px 14px; }
    .card { margin-top:13px; border:1px solid var(--line); border-radius:var(--card-radius); overflow:hidden;
      background:var(--card-bg); box-shadow:var(--card-shadow); }
    .card summary, .card .section-heading { display:flex; align-items:center; justify-content:space-between; cursor:pointer;
      list-style:none; padding:13px 14px; background:var(--section-top); font-weight:750; color:var(--soft); }
    .card > summary, .card > .section-heading { border-inline-start:var(--section-rule); }
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
    .note { margin:10px 16px 14px; padding:12px 14px; border:1px solid var(--line); border-radius:var(--card-radius);
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
