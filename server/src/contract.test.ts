import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedNumbers, BadRequest, numbersIn, parseRequest, vetResponse } from './contract.ts';

const request = parseRequest({
  month: 'October 2026',
  facts: [
    { parameter: 'top_category', summary: 'Food is your biggest category: ₹9,480, 27% of spending.', values: { category: 'Food', amount: 9480, sharePct: 27 } },
    { parameter: 'small_spends', summary: '14 payments under ₹200 added up to ₹1,420.', values: { count: 14, total: 1420, limit: 200 } },
  ],
  avoid: ['Old title'],
});

test('parses a valid request', () => {
  assert.equal(request.facts.length, 2);
  assert.deepEqual(request.avoid, ['Old title']);
});

test('rejects unknown or repeated parameters and bad values', () => {
  const fact = { parameter: 'top_category', summary: 'x', values: {} };
  assert.throws(() => parseRequest({ month: 'Oct', facts: [{ ...fact, parameter: 'weather' }] }), BadRequest);
  assert.throws(() => parseRequest({ month: 'Oct', facts: [fact, fact] }), BadRequest);
  assert.throws(() => parseRequest({ month: 'Oct', facts: [{ ...fact, values: { a: Infinity } }] }), BadRequest);
  assert.throws(() => parseRequest({ month: 'Oct', facts: [] }), BadRequest);
  assert.throws(() => parseRequest('nope'), BadRequest);
});

test('normalises numbers in text', () => {
  assert.deepEqual(numbersIn('₹9,480 is 27% of ₹35,100.50'), ['9480', '27', '35100.50']);
  assert.ok(allowedNumbers(request).has('1420'));
  assert.ok(allowedNumbers(request).has('2026'));
});

test('keeps honest output and drops invented numbers, unknown parameters and duplicates', () => {
  const vetted = vetResponse(
    {
      insights: [
        { parameter: 'top_category', title: 'Food took 27% of your money', detail: 'That is ₹9,480 this month.', action: 'Cook twice a week.', tone: 'warning' },
        { parameter: 'top_category', title: 'Duplicate', detail: 'Again.', action: 'Again.', tone: 'neutral' },
        { parameter: 'small_spends', title: 'Small spends hit ₹2,000', detail: 'Invented.', action: 'x', tone: 'neutral' },
        { parameter: 'recurring', title: 'Not sent', detail: 'x', action: 'x', tone: 'neutral' },
        { parameter: 'small_spends', title: 'Tiny payments add up', detail: '14 of them cost ₹1,420.', action: 'Pause before paying under ₹200.', tone: 'neutral' },
      ],
      stories: [
        { parameter: 'top_category', text: 'Food became your largest expense this month.' },
        { parameter: 'small_spends', text: 'You made 15 tiny payments.' },
        { parameter: 'small_spends', text: '14 small payments quietly cost ₹1,420.' },
      ],
    },
    request,
  );
  assert.deepEqual(vetted.insights.map(i => i.title), ['Food took 27% of your money', 'Tiny payments add up']);
  assert.deepEqual(vetted.stories.map(s => s.text), [
    'Food became your largest expense this month.',
    '14 small payments quietly cost ₹1,420.',
  ]);
});

test('survives a malformed model reply', () => {
  assert.deepEqual(vetResponse(null, request), { insights: [], stories: [] });
  assert.deepEqual(vetResponse({ insights: 'x', stories: [1] }, request), { insights: [], stories: [] });
});
