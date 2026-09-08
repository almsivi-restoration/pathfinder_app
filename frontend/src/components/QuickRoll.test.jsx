/**
 * Tests for the Quick Roll dialog: skill/save modifiers come from the selected
 * actor's sheet (numbers on character sheets, text on monster sheets), ability
 * checks derive from ability scores, and custom rolls need no actor at all.
 * rollDice is stubbed - the /api/roll contract itself is covered by
 * backend/tests/test_api.py.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickRoll from './QuickRoll';
import { useStore } from '../store';

const initialState = useStore.getState();

const valeros = {
  id: 'a1',
  name: 'Valeros',
  sheet: {
    abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 9, cha: 10 },
    skills: [
      { name: 'Climb', total: 7 },
      { name: 'Stealth', total: 2 },
    ],
    saves: [{ name: 'Fortitude', total: 5 }],
  },
};

// Monster-sheet shape: ability scores and skill totals are free text.
const goblin = {
  id: 'a2',
  name: 'Goblin',
  sheet: {
    abilities: { str: '8', dex: '16' },
    skills: [{ name: 'Stealth', total: '+12' }],
  },
};

beforeEach(() => {
  useStore.setState(initialState, true);
});

function seedStore(actors, rollResult) {
  const rollDice = jest.fn(async () => rollResult);
  useStore.setState({ actors, rollDice });
  return rollDice;
}

test('rolls a skill check with the modifier from the actor sheet', async () => {
  const rollDice = seedStore([valeros, goblin], { total: 12, die_roll: 10, modifier: 2, bonus_dice_roll: null });
  render(<QuickRoll onClose={() => {}} />);

  fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'a1' } });
  fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Stealth' } });
  fireEvent.click(screen.getByRole('button', { name: 'Roll' }));

  await waitFor(() => expect(rollDice).toHaveBeenCalledWith({ dieType: 20, modifier: 2 }));
  expect(await screen.findByText('Valeros — Stealth')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
});

test('parses monster-sheet text totals like "+12"', async () => {
  const rollDice = seedStore([valeros, goblin], { total: 23, die_roll: 11, modifier: 12, bonus_dice_roll: null });
  render(<QuickRoll onClose={() => {}} />);

  fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'a2' } });
  // The goblin has a single skill, auto-selected.
  fireEvent.click(screen.getByRole('button', { name: 'Roll' }));

  await waitFor(() => expect(rollDice).toHaveBeenCalledWith({ dieType: 20, modifier: 12 }));
});

test('ability checks derive the modifier from the ability score', async () => {
  const rollDice = seedStore([valeros], { total: 11, die_roll: 12, modifier: -1, bonus_dice_roll: null });
  render(<QuickRoll onClose={() => {}} />);

  fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'a1' } });
  fireEvent.change(screen.getByLabelText('Roll'), { target: { value: 'ability' } });
  fireEvent.change(screen.getByLabelText('Ability Check'), { target: { value: 'WIS' } });
  fireEvent.click(screen.getByRole('button', { name: 'Roll' }));

  // WIS 9 -> Math.floor((9 - 10) / 2) = -1, matching both rulesets' curve.
  await waitFor(() => expect(rollDice).toHaveBeenCalledWith({ dieType: 20, modifier: -1 }));
});

test('custom rolls work with no scene open and no actor selected', async () => {
  const rollDice = seedStore([], { total: 88, die_roll: 85, modifier: 3, bonus_dice_roll: null });
  render(<QuickRoll onClose={() => {}} />);

  // With no actor a skill/save/ability roll is impossible - the button is disabled.
  expect(screen.getByRole('button', { name: 'Roll' })).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Roll'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Secret Door' } });
  fireEvent.change(screen.getByLabelText('Die'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Modifier'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Roll' }));

  await waitFor(() => expect(rollDice).toHaveBeenCalledWith({ dieType: 100, modifier: 3 }));
  expect(await screen.findByText('Secret Door')).toBeInTheDocument();
});
