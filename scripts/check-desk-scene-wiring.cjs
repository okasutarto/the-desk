// Run: node scripts/check-desk-scene-wiring.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const root = path.join(__dirname, '../src/features/desk3d');
const entry = fs.readFileSync(path.join(root, 'deskScene.js'), 'utf8');
const parts = new Map();
for (const file of fs.readdirSync(path.join(root, 'scene'))) {
  if (!file.endsWith('.js')) continue;
  const source = fs.readFileSync(path.join(root, 'scene', file), 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const factory = ast.program.body.find(node => node.type === 'ExportNamedDeclaration').declaration;
  const api = factory.body.body.at(-1).argument;
  assert.equal(api.type, 'ObjectExpression', file + ' has an explicit API');
  parts.set(file.slice(0, -3), { source, ast, factory, api });
}
// Direct reads during construction must only touch already-published parts. Reads in
// callbacks and methods remain deferred; the API checks below validate those separately.
const assembly = [...entry.matchAll(/runtime\.(\w+) = create\w+\(runtime\)/g)].map(match => match[1]);
// Lifecycle is returned directly after all scene parts have been published.
assembly.push('lifecycle');
let constructionReads = 0;
for (const [name, part] of parts) {
  assert.ok(assembly.includes(name), `${name}: assembled by the entry point`);
  traverse(part.ast, { MemberExpression(p) {
    const { object } = p.node;
    if (object.type !== 'MemberExpression' || object.object.name !== 'runtime' || object.property.name === 'options') return;
    if (p.getFunctionParent()?.node !== part.factory) return;
    const owner = object.property.name;
    assert.ok(assembly.indexOf(owner) >= 0 && assembly.indexOf(owner) < assembly.indexOf(name),
      `${name}: construction reads ${owner} before it is initialized`);
    constructionReads++;
  } });
}
assert.ok(constructionReads > 0, 'construction dependencies were inspected');
let links = 0;
for (const [name, part] of parts) {
  traverse(part.ast, { MemberExpression(p) {
    const { object, property } = p.node;
    if (object.type !== 'MemberExpression' || object.object.name !== 'runtime') return;
    const owner = object.property.name;
    if (owner === 'options') return;
    const target = parts.get(owner);
    assert.ok(target, `${name}: unknown scene part ${owner}`);
    const properties = target.api.properties.filter(node => node.key.name === property.name);
    assert.ok(properties.some(node => node.kind !== 'set'), `${name}: ${owner}.${property.name} is exported`);
    const writes = p.parentPath.isAssignmentExpression() && p.key === 'left' || p.parentPath.isUpdateExpression();
    if (writes) assert.ok(properties.some(node => node.kind === 'set'), `${name}: ${owner}.${property.name} has a live setter`);
    links++;
  } });
}
assert.ok(entry.indexOf('runtime.animation.start()') > entry.indexOf('runtime.animation = createAnimation(runtime)'), 'animation starts after its state is published');
assert.ok(!parts.get('animation').factory.body.body.some(node => node.type === 'ExpressionStatement' && node.expression.callee?.name === 'resize'), 'resize cannot run during factory assembly');

// Exercise the real input module across the factory boundary, including writes through the
// returned live accessors. No reconstructed source is used in these checks.
const events = new Map();
const textarea = {
  style: {}, value: '', setAttribute() {}, focus() {}, blur() {}, setSelectionRange() {},
  addEventListener: (name, callback) => events.set(name, callback),
};
const createTextInput = vm.runInNewContext(parts.get('textInput').source.replace('export function', 'function') + '; createTextInput', {
  document: { createElement: () => textarea, addEventListener() {}, removeEventListener() {} },
});
let back = 0;
const pressed = [];
const runtime = { options: { container: { appendChild: element => assert.equal(element, textarea) } } };
const input = createTextInput(runtime);
// These dependencies are deliberately supplied later, as they are in scene assembly.
runtime.camera = { back: () => back++ };
runtime.keyboard = { pressKey: code => pressed.push(code) };
let text = 'hello';
let submits = 0;
let stopped = 0;
let tabDirection = 0;
const field = { get: () => text, set: value => { text = value; }, redraw() {},
  onEnter: () => submits++, onStop: () => stopped++, onTab: direction => { tabDirection = direction; } };
input.startTyping(field);
assert.equal(input.typing, field);
assert.equal(textarea.value, 'hello');
textarea.value = 'hello desk';
events.get('input')();
assert.equal(text, 'hello desk');
const key = (key, extra = {}) => events.get('keydown')({ key, code: 'KeyA', preventDefault() {}, ...extra });
key('a');
assert.deepEqual(pressed, ['KeyA']);
key('Tab', { shiftKey: true });
assert.equal(tabDirection, -1);
key('Enter');
assert.equal(submits, 1);
input.caretOn = false;
assert.equal(input.caretOn, false);
key('Escape');
assert.equal(back, 1);
assert.equal(stopped, 1);
assert.equal(input.typing, null);
input.startTyping(field);
assert.equal(input.caretOn, true, 'starting input resets the same caret state exposed to the render loop');
input.stopTyping();

// Cleanup must use the same listener functions installed by the animation factory.
const cleanup = parts.get('lifecycle').source;
assert.ok(cleanup.includes('removeEventListener("resize", runtime.animation.resize)'));
assert.ok(cleanup.includes('removeEventListener("change", runtime.animation.onDensityChange)'));
console.log(`Scene wiring: ${parts.size} factories, ${links} dependency references, startup order, live input state and listener identities passed.`);
