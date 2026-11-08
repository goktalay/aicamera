'use strict';
// design-system/tokens.json → CSS değişkenleri. Tek kaynak tokens.json; uygulama bu çıktıyı /tokens.css olarak sunar.
const fs = require('node:fs');
const path = require('node:path');

const TOKENS = path.join(__dirname, '..', 'design-system', 'tokens.json');

function val(v) {
  return typeof v === 'string' ? v.replace(/^\{([A-Za-z0-9_.-]+)\}$/, 'var(--$1)') : v;
}

function build() {
  const t = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
  const themes = t.color.themes.map((x) => x.id);
  const first = themes[0];
  const themed = [...t.color.tokens, ...((t.shadow && t.shadow.tokens) || [])];
  const decl = (theme) => themed.map((tok) => {
    const v = typeof tok.value === 'string' ? tok.value : (tok.value[theme] ?? tok.value[first]);
    return `  --${tok.name}: ${val(v)};`;
  }).join('\n');

  let css = `/* ${t.name} — tokens.json'dan üretildi */\n`;
  css += `:root, [data-theme="${first}"] {\n${decl(first)}\n  color-scheme: ${first === 'dark' ? 'dark' : 'light'};\n}\n`;
  for (const th of themes.slice(1)) {
    css += `[data-theme="${th}"] {\n${decl(th)}\n  color-scheme: ${th === 'dark' ? 'dark' : 'light'};\n}\n`;
  }
  const plain = [...(t.spacing?.tokens || []), ...(t.radius?.tokens || [])].map((tok) => `  --${tok.name}: ${tok.value};`);
  const fam = Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`);
  css += `:root {\n${[...plain, ...fam].join('\n')}\n}\n`;
  return css;
}

module.exports = { build };
