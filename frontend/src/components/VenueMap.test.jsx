import { render } from '@testing-library/react';
import VenueMap from './VenueMap';

const VENUE = {
  id: 'v1',
  name: 'Crypt',
  grid: 'square',
  width: 4,
  height: 3,
  notes: 'The lich is behind the secret door.',
  cells: {
    '0,0': 'floor', '1,0': 'floor', '2,0': 'flagstone', '3,0': 'flagstone',
    '0,1': 'floor', '1,1': 'water', '2,1': 'flagstone', '3,1': 'flagstone',
  },
  edges: [
    { x: 1, y: 0, side: 'w', kind: 'door' },
    { x: 2, y: 0, side: 'w', kind: 'secret_door' },
  ],
  features: [
    { id: 'a', kind: 'chest', x: 0, y: 0, rotation: 0, label: 'Gold', gm_only: false },
    { id: 'b', kind: 'trap', x: 3, y: 1, rotation: 90, label: '', gm_only: true },
    { id: 'c', kind: 'label', x: 2, y: 1, rotation: 0, label: '', gm_only: false },
  ],
};

const featureIds = (container) => [...container.querySelectorAll('[data-feature-id]')].map((node) => node.dataset.featureId);

test('the GM view shows secret doors and GM-only stamps', () => {
  const { container } = render(<VenueMap venue={VENUE} mode="gm" />);

  expect(container.querySelectorAll('.venue-map-door')).toHaveLength(1);
  expect(container.querySelectorAll('.venue-map-secret')).toHaveLength(1);
  expect(featureIds(container)).toEqual(['a', 'b', 'c']);
  expect(container.querySelector('[data-feature-id="b"]')).toHaveClass('gm-only');
});

test('the player view hides secret doors, GM-only stamps, and empty labels', () => {
  const { container } = render(<VenueMap venue={VENUE} mode="player" />);

  expect(container.querySelectorAll('.venue-map-door')).toHaveLength(1);
  expect(container.querySelector('.venue-map-secret')).toBeNull();
  expect(featureIds(container)).toEqual(['a']);
  expect(container.textContent).not.toContain('lich');
});

test('each terrain gets one fill path and patterned terrains get a pattern', () => {
  const { container } = render(<VenueMap venue={VENUE} />);

  const terrains = [...container.querySelectorAll('[data-terrain]')].map((node) => node.dataset.terrain).sort();
  expect(terrains).toEqual(['flagstone', 'floor', 'water']);
  expect(container.querySelector('[data-terrain="flagstone"]').getAttribute('fill')).toMatch(/^url\(#vt/);
  expect(container.querySelector('[data-terrain="floor"]').getAttribute('fill')).toMatch(/^#/);
});

test('two maps on one page do not share pattern ids', () => {
  const { container } = render(
    <>
      <VenueMap venue={VENUE} />
      <VenueMap venue={VENUE} mode="player" />
    </>,
  );
  const ids = [...container.querySelectorAll('pattern, clipPath')].map((node) => node.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('sizes itself from pxPerCell, or fills its container without it', () => {
  const sized = render(<VenueMap venue={VENUE} pxPerCell={20} />).container.querySelector('svg');
  expect(sized.getAttribute('width')).toBe('100');
  expect(sized.getAttribute('height')).toBe('80');

  const fluid = render(<VenueMap venue={VENUE} />).container.querySelector('svg');
  expect(fluid.getAttribute('width')).toBe('100%');
});
