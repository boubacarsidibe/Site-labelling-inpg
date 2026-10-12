// Render diagrams of an .mdj with StarUML's own engine (metadata-json) to PDF, one page per diagram.
const mdjson = require('metadata-json');
const L = '/usr/share/fonts/truetype/liberation';
for (const name of ['default', 'Arial', 'Helvetica Neue', 'Liberation Sans'])
  mdjson.Font.registerFont({ name, path: L, regular: 'LiberationSans-Regular.ttf', italic: 'LiberationSans-Italic.ttf', bold: 'LiberationSans-Bold.ttf', boldItalic: 'LiberationSans-BoldItalic.ttf' });
mdjson.loadFromFile(process.argv[2]);
const ds = mdjson.Repository.getInstancesOf('Diagram');
const want = (process.argv[4] || '').split(',').filter(Boolean);
const pick = want.length ? ds.filter(d => want.includes(d.name)) : ds;
console.log(pick.map(d => d.name).join(' | '));
mdjson.exportToPDF(pick, process.argv[3], { size: 'A3', layout: 'landscape', showName: true });
console.log('pdf ok');
