import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `export * from './src/core/utils/phoneValidation';`,
    resolveDir: process.cwd(),
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  define: { 'import.meta.env': '{}' }
});

const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
);

const { validatePhoneNumber, sanitizePhoneNumber } = compiled.exports;

test('validatePhoneNumber checks mandatory status', () => {
  const reqEmpty = validatePhoneNumber('', true);
  assert.equal(reqEmpty.isValid, false);
  assert.equal(reqEmpty.error, 'Phone number is mandatory.');

  const optEmpty = validatePhoneNumber('', false);
  assert.equal(optEmpty.isValid, true);
  assert.equal(optEmpty.error, undefined);
});

test('validatePhoneNumber validates 10-digit standard Indian mobile numbers', () => {
  const validMobile = validatePhoneNumber('9825012345', true);
  assert.equal(validMobile.isValid, true);
  assert.equal(validMobile.digitCount, 10);
  assert.equal(validMobile.error, undefined);

  const validGfl = validatePhoneNumber('9876543210', true);
  assert.equal(validGfl.isValid, true);
  assert.equal(validGfl.digitCount, 10);
});

test('validatePhoneNumber validates numbers with country code or separators', () => {
  const withPlus91 = validatePhoneNumber('+91 98250 12345', true);
  assert.equal(withPlus91.isValid, true);
  assert.equal(withPlus91.digitCount, 12);

  const withHyphens = validatePhoneNumber('+91-98250-12345', true);
  assert.equal(withHyphens.isValid, true);
  assert.equal(withHyphens.digitCount, 12);

  const withLeadingZero = validatePhoneNumber('09825012345', true);
  assert.equal(withLeadingZero.isValid, true);
  assert.equal(withLeadingZero.digitCount, 11);
});

test('validatePhoneNumber rejects numbers with fewer than 10 digits', () => {
  const shortNum = validatePhoneNumber('98250', true);
  assert.equal(shortNum.isValid, false);
  assert.equal(shortNum.digitCount, 5);
  assert.match(shortNum.error, /incomplete \(5\/10 digits\)/);
});

test('validatePhoneNumber rejects numbers with more than 15 digits', () => {
  const longNum = validatePhoneNumber('1234567890123456', true);
  assert.equal(longNum.isValid, false);
  assert.equal(longNum.digitCount, 16);
  assert.match(longNum.error, /exceeds standard length/);
});

test('validatePhoneNumber rejects invalid alphabetic or symbolic characters', () => {
  const withLetters = validatePhoneNumber('98250abc12', true);
  assert.equal(withLetters.isValid, false);
  assert.match(withLetters.error, /Invalid format/);
});

test('sanitizePhoneNumber strips disallowed characters and respects maxLength', () => {
  assert.equal(sanitizePhoneNumber('98250abc12', 16), '9825012');
  assert.equal(sanitizePhoneNumber('+91 98250 12345', 16), '+91 98250 12345');
  assert.equal(sanitizePhoneNumber('12345678901234567890', 16), '1234567890123456');
  assert.equal(sanitizePhoneNumber('12345678901234567890', 20), '12345678901234567890');
});
