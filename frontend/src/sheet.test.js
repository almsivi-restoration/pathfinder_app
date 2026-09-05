import { createDefaultSheet, getSheetValue, setSheetValue } from './sheet';

const actorSheet = {
  fields: [
    { key: 'hp.current', default: 10 },
    { key: 'weapons', default: [] },
  ],
};

test('creates nested defaults from a ruleset sheet definition', () => {
  const sheet = createDefaultSheet(actorSheet);

  expect(sheet).toEqual({ hp: { current: 10 }, weapons: [] });
});

test('updates a nested sheet value without mutating its source', () => {
  const original = { hp: { current: 10, max: 10 } };
  const updated = setSheetValue(original, 'hp.current', 7);

  expect(updated.hp.current).toBe(7);
  expect(getSheetValue(original, 'hp.current')).toBe(10);
});