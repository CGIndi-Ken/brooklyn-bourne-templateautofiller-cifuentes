const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'fields.js'),'utf8'),context);
const infer = context.gramsFromTitle;
const cases = [
  ['BRAND | STRAIN | 3.5g (H)','3.5'],
  ['BRAND | STRAIN | 100mg (I)','0.1'],
  ['BRAND | STRAIN | 100 MG, Edibles (S)','0.1'],
  ['BRAND | STRAIN | .5 G (I/H)','0.5'],
  ['BRAND | STRAIN | 0.123mg (S/H)','0.000123'],
  ['BRAND | STRAIN | 003.5000g, Flower (H)','3.5'],
  ['BRAND | STRAIN | 1000mg, Gummies, Qty 10 (I)','1'],
  ['BRAND | STRAIN | 3.5g, 2-pack, Pre-Roll Packs (H)','3.5'],
  ['BRAND | STRAIN | 0.5g, 2-pack (H)','0.5'],
  ['BRAND | STRAIN | 1g 2pk (H)','1'],
  ['BRAND | STRAIN | 1g 2pk Prerolls (H)','1'],
  ['BRAND | STRAIN | 1g, 2-pack Pre-Roll Packs (H)','1'],
  ['BRAND | STRAIN | 0.5g, 2, Prerolls (H)','0.5'],
  ['BRAND | STRAIN | 0.5g, Flower (New Category) (H)','0.5'],
  ['BRAND 100mg | STRAIN 3.5g | 1g (H)','1'],
  ['BRAND | STRAIN | 1.0000000000000001g (H)','1.0000000000000001'],
  ['BRAND | STRAIN | 1.0000000000000001mg (H)','0.0010000000000000001'],
];
for (const [title,grams] of cases) assert.equal(infer(title),grams,title);
const rejected = [
  undefined, null, {}, 100, '', 'Runtz 3.5g (H)', '3.5g',
  'BRAND 3.5g | STRAIN | Flower (H)',
  'BRAND | STRAIN 3.5g | (H)',
  'BRAND | STRAIN | 3.5g | Flower (H)',
  'BRAND | STRAIN | -3.5g (H)',
  'BRAND | STRAIN | +3.5g (H)',
  'BRAND | STRAIN | 1,000g (H)',
  'BRAND | STRAIN | 1.2.3g (H)',
  'BRAND | STRAIN | 3.g (H)',
  'BRAND | STRAIN | 1e3mg (H)',
  'BRAND | STRAIN | Infinityg (H)',
  'BRAND | STRAIN | NaNmg (H)',
  'BRAND | STRAIN | 0g (H)',
  'BRAND | STRAIN | 0.000mg (H)',
  'BRAND | STRAIN | 1oz (H)',
  'BRAND | STRAIN | 1kg (H)',
  'BRAND | STRAIN | 1ml (H)',
  'BRAND | STRAIN | 1gm (H)',
  'BRAND | STRAIN | 1grams (H)',
  'BRAND | STRAIN | 1g2 (H)',
  'BRAND | STRAIN | 1g / 500mg (H)',
  'BRAND | STRAIN | 100mg THC (H)',
  'BRAND | STRAIN | 100mg, 10mg THC per piece (H)',
  'BRAND | STRAIN | 100mg, 100mg CBD (H)',
  'BRAND | STRAIN | 1g, THCA (H)',
  'BRAND | STRAIN | 2 x 0.5g (H)',
  'BRAND | STRAIN | 2×0.5g (H)',
  'BRAND | STRAIN | 0.5g x 2 (H)',
  'BRAND | STRAIN | 0.5g × 2 (H)',
  'BRAND | STRAIN | 0.5g, -2-pack (H)',
  'BRAND | STRAIN | 0.5g, 2.5-pack (H)',
  `BRAND | STRAIN | ${'9'.repeat(400)}g (H)`,
];
for (const title of rejected) assert.equal(infer(title),'',String(title));
console.log(`Passed title weight parsing: ${cases.length} recognized sizes/conversions and ${rejected.length} malformed, ambiguous, dosage or unsupported titles.`);
