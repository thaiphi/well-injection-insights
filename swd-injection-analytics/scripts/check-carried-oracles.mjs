import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { generateBlackOilTable } from '../dist/vendor/nexus/components/black-oil-tables/engine/generateBlackOilTable.js';

const fixturePath = 'reference/nexus/components/black-oil-tables/engine/__tests__/pyrtValidation.test.ts';
const original = await readFile(fixturePath, 'utf8');
const manifest = JSON.parse(await readFile('reference/nexus-source-manifest.json', 'utf8'));
const entry = manifest.files.find(file => file.destination === fixturePath);
if (!entry || createHash('sha256').update(original).digest('hex') !== entry.destinationSha256) {
  throw Error('Recorded oracle fixture differs from the extracted Nexus reference');
}
const source = ts.createSourceFile(fixturePath, original, ts.ScriptTarget.Latest, true);
// Parse only literal data. Do not execute the upstream Vitest suite or its helpers.
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw Error('Nonliteral oracle property');
    return [property.name.text, literal(property.initializer)];
  }));
  throw Error(`Nonliteral oracle syntax: ${ts.SyntaxKind[node.kind]}`);
}
function constant(name) {
  let value;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) value = literal(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (value === undefined) throw Error(`Recorded oracle constant missing: ${name}`);
  return value;
}
const cases = constant('VALIDATION_CASES'), config = constant('STANDING_CONFIG'), tolerances = constant('TOLERANCES');
const fields = [
  ['rs', 'Rs', 'rs', 1000], ['bo', 'Bo', 'bo', 1], ['oilDensity', 'Deno', 'oilDensity', 1],
  ['oilViscosity', 'uo', 'oilViscosity', 1], ['zFactor', 'Z', 'zFactor', 1], ['bg', 'Bg', 'bg', 1],
  ['gasViscosity', 'ug', 'gasViscosity', 1], ['bw', 'Bw', 'bw', 1], ['waterViscosity', 'uw', 'waterViscosity', 1],
];
const report = {
  sourceCommit: manifest.head, referenceFile: fixturePath, referenceSha256: entry.destinationSha256,
  oracleRecordedAt: '2026-04-16', liveMcpCall: false, runner: 'direct Node literal-fixture audit; upstream Vitest not executed',
  pressureMatching: 'Each oracle pressure is evaluated exactly as the first point of a two-row P to P+1 psia table; no nearest-grid skips.',
  exclusions: ['Rs below 100 psia: original documented extrapolation exclusion.', 'Oil compressibility: original tolerance 999 is effectively skipped; no agreement claim.', 'Gas compressibility: original ideal/real-gas difference exclusion.', 'Water compressibility: absent from recorded oracle.'],
  cases: [], comparisons: 0, failures: [],
};
for (const example of cases) {
  const result = { label: example.label, pressures: example.pyrtRows.length, comparisons: 0, maxRelativeErrorByField: {} };
  for (const oracle of example.pyrtRows) {
    const generated = generateBlackOilTable({ ...example.inputs, pressureMin: oracle.P, pressureMax: oracle.P + 1, numRows: 2 }, config);
    const row = generated.rows.find(row => row.pressure === oracle.P);
    if (!row) throw Error(`Exact oracle pressure missing: ${example.label} at ${oracle.P}`);
    for (const [actualField, oracleField, toleranceField, conversion] of fields) {
      if (actualField === 'rs' && oracle.P < 100) continue;
      const expected = oracle[oracleField] * conversion;
      const relativeError = Math.abs(row[actualField] - expected) / Math.abs(expected);
      result.comparisons++; report.comparisons++;
      result.maxRelativeErrorByField[actualField] = Math.max(result.maxRelativeErrorByField[actualField] ?? 0, relativeError);
      if (!Number.isFinite(relativeError) || relativeError >= tolerances[toleranceField]) report.failures.push({ label: example.label, pressurePsia: oracle.P, field: actualField, actual: row[actualField], expected, relativeError, tolerance: tolerances[toleranceField] });
    }
  }
  report.cases.push(result);
}
await mkdir('exhibits', { recursive: true });
await writeFile('exhibits/carried-oracle-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(`${cases.length} recorded cases, ${cases.reduce((sum, item) => sum + item.pyrtRows.length, 0)} exact pressure points, ${report.comparisons} comparisons, ${report.failures.length} failures; exclusions preserved.`);
if (report.failures.length) {
  console.error(JSON.stringify(report.failures, null, 2));
  process.exitCode = 1;
}
