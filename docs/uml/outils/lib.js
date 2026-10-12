// Build StarUML (.mdj) models with StarUML's own metamodel classes (metadata-json),
// let the engine compute view geometry, then serialize.
const fs = require('fs');
const mdjson = require('metadata-json');
const PDFDocument = require('pdfkit');
const T = global.type;
const R = mdjson.Repository;
const ID = () => mdjson.IdGenerator.generateGuid();
// elements are not indexed in the Repository: assign fields directly
R.bypassFieldAssign = (elem, field, val) => { elem[field] = val; };
const LIB = '/usr/share/fonts/truetype/liberation';
for (const name of ['default', 'Arial'])
  mdjson.Font.registerFont({ name, path: LIB, regular: 'LiberationSans-Regular.ttf', italic: 'LiberationSans-Italic.ttf', bold: 'LiberationSans-Bold.ttf', boldItalic: 'LiberationSans-BoldItalic.ttf' });

function canvas() {
  const doc = new PDFDocument();
  for (const [n, p] of Object.entries(mdjson.Font.files)) doc.registerFont(n, p);
  return new mdjson.PDFGraphics.Canvas(doc);
}

// create a model element and attach it to parent[field]
function el(Type, parent, props = {}, field = 'ownedElements') {
  const e = new T[Type]();
  e._id = ID();
  if (parent) { e._parent = parent; parent[field].push(e); }
  Object.assign(e, props);
  return e;
}

// create a view on a diagram
function view(Type, diagram, model, geo = {}, props = {}) {
  const v = new T[Type]();
  v._id = ID(); v._parent = diagram; v.model = model || null;
  // ids for auto-created subviews (recursively)
  const fix = (x) => { (x.subViews || []).forEach(s => { if (!s._id) s._id = ID(); s._parent = x; if (!s.model && model && !(s instanceof T.EdgeLabelView) && !(s instanceof T.LabelView)) s.model = model; fix(s); }); };
  fix(v);
  Object.assign(v, geo, props);
  diagram.ownedViews.push(v);
  return v;
}

function edge(Type, diagram, model, tail, head, props = {}, via = null) {
  const v = view(Type, diagram, model, {}, props);
  v.tail = tail; v.head = head;
  v._via = via;
  return v;
}

function ensureIds(x) {
  (x.subViews || []).forEach(s => { if (!s._id) s._id = ID(); if (!s._parent) s._parent = x; ensureIds(s); });
}

// lay out all views of a diagram with the engine
function layout(diagram) {
  const c = canvas();
  const nodes = diagram.ownedViews.filter(v => !(v instanceof T.EdgeView));
  const edges = diagram.ownedViews.filter(v => v instanceof T.EdgeView);
  for (let pass = 0; pass < 2; pass++) {
    for (const v of nodes) { v.setup(c); v.update(c); v.size(c); v.arrange(c); ensureIds(v); }
  }
  for (const v of edges) {
    if (v.points.count() === 0) {
      v.initialize(c);
      if (v._via) {
        const p0 = v.points.getPoint(0), p1 = v.points.getPoint(1);
        v.points.clear(); v.points.add(p0);
        for (const [x, y] of v._via) v.points.add(new mdjson.Graphics.Point(x, y));
        v.points.add(p1);
      }
    }
    v.setup(c); v.update(c); v.size(c); v.arrange(c); ensureIds(v);
  }
  for (const v of nodes) { v.update(c); v.size(c); v.arrange(c); ensureIds(v); }
  for (const v of edges) { delete v._via; }
}

function project(name) {
  const p = new T.Project(); p._id = ID(); p.name = name;
  R.setRoot ? R.setRoot(p) : null;
  return p;
}

function save(proj, file) {
  const json = R.writeObject(proj);
  fs.writeFileSync(file, json);
  return json.length;
}

module.exports = { T, R, ID, el, view, edge, layout, project, save, mdjson, canvas };
