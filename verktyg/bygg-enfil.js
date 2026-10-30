// Bygger dist/rullverket.html: hela spelet i en enda fil (för att dela som länk).
// Matter.js hämtas då från cdnjs i stället för vendor-mappen.
const fs = require('fs');
const path = require('path');
const p = (f) => path.join(__dirname, '..', 'public', f);
let html = fs.readFileSync(p('index.html'), 'utf8');
const css = fs.readFileSync(p('style.css'), 'utf8');
const banor = fs.readFileSync(p('banor.json'), 'utf8');
const motor = fs.readFileSync(p('motor.js'), 'utf8');
const spel = fs.readFileSync(p('spel.js'), 'utf8');
const ikon = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(p('ikoner/ikon.svg'))).toString('base64');
html = html
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace('href="ikoner/ikon.svg"', `href="${ikon}"`)
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}</style>`)
  .replace('<script src="vendor/matter.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>')
  .replace('<script src="motor.js"></script>', () => `<script type="application/json" id="banor-data">\n${banor}</script>\n<script>\n${motor}</script>`)
  .replace('<script src="spel.js"></script>', () => `<script>\n${spel}</script>`);
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'rullverket.html'), html);
console.log('dist/rullverket.html', (html.length / 1024).toFixed(0) + ' kB');
