/**
 * SymbolPicker: a swatch-sized button showing the current marker symbol, opening
 * a grid of drawable shapes plus None. Escape and outside clicks dismiss it, and
 * re-choosing the current symbol is not reported as a change.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import SymbolPicker from './SymbolPicker';
import { MARKER_SYMBOLS } from '../markerSymbols';

test('offers every catalog symbol plus None and reports the choice', () => {
  const onChange = jest.fn();
  render(<SymbolPicker symbol={null} color="#c0392b" onChange={onChange} />);

  fireEvent.click(screen.getByLabelText('Assign a marker symbol'));
  for (const symbol of MARKER_SYMBOLS) {
    expect(screen.getByRole('button', { name: symbol.label })).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Crescent' }));
  expect(onChange).toHaveBeenCalledWith('crescent');
});

test('shows the current symbol and clears it with None', () => {
  const onChange = jest.fn();
  render(<SymbolPicker symbol="diamond" color="#2980b9" onChange={onChange} />);

  const button = screen.getByLabelText('Marker symbol: Diamond');
  expect(button).toHaveClass('assigned');
  fireEvent.click(button);
  expect(screen.getByRole('button', { name: 'Diamond' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Diamond' }));
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.click(button);
  fireEvent.click(screen.getByRole('button', { name: 'No symbol' }));
  expect(onChange).toHaveBeenCalledWith(null);
});

test('Escape and outside clicks close the popover', () => {
  render(
    <div>
      <SymbolPicker symbol={null} onChange={jest.fn()} />
      <p>outside</p>
    </div>
  );
  const button = screen.getByLabelText('Assign a marker symbol');

  fireEvent.click(button);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('group', { name: 'Marker symbols' })).not.toBeInTheDocument();

  fireEvent.click(button);
  fireEvent.mouseDown(screen.getByText('outside'));
  expect(screen.queryByRole('group', { name: 'Marker symbols' })).not.toBeInTheDocument();
});

// The popover is portaled out of the row's tab order, so it has to take focus
// itself and hand it back, or a keyboard user can open it but never reach it.
test('the keyboard reaches the popover, moves through it, and returns to the button', () => {
  const onChange = jest.fn();
  render(<SymbolPicker symbol="ring" color="#3060d0" onChange={onChange} />);
  const button = screen.getByLabelText('Marker symbol: Ring');

  fireEvent.click(button);
  expect(screen.getByRole('button', { name: 'Ring' })).toHaveFocus();

  const popover = screen.getByRole('group', { name: 'Marker symbols' });
  fireEvent.keyDown(popover, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'Cross' })).toHaveFocus();
  fireEvent.keyDown(popover, { key: 'ArrowDown' });
  expect(screen.getByRole('button', { name: 'Diamond' })).toHaveFocus();
  // Below the last row is None, whichever column the focus is in.
  fireEvent.keyDown(popover, { key: 'ArrowDown' });
  fireEvent.keyDown(popover, { key: 'ArrowDown' });
  expect(screen.getByRole('button', { name: 'No symbol' })).toHaveFocus();

  // Tabbing past the end closes the popover and resumes from the button.
  fireEvent.keyDown(popover, { key: 'Tab' });
  expect(screen.queryByRole('group', { name: 'Marker symbols' })).not.toBeInTheDocument();
  expect(button).toHaveFocus();

  fireEvent.click(button);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(button).toHaveFocus();
  expect(onChange).not.toHaveBeenCalled();
});

test('an unassigned picker draws a blank base rather than a typed glyph', () => {
  render(<SymbolPicker symbol={null} onChange={jest.fn()} />);
  const button = screen.getByLabelText('Assign a marker symbol');

  expect(button.querySelector('svg.symbol-picker-empty')).not.toBeNull();
  expect(button.textContent).toBe('');
});

// Actor rows are isolated stacking contexts in a scrolling list; the popover
// must escape both, and pressing inside it must not count as an outside click.
test('the popover renders outside the row and stays open for presses inside it', () => {
  const { container } = render(
    <div className="actor-row">
      <SymbolPicker symbol="ring" color="#3060d0" onChange={jest.fn()} />
    </div>
  );

  fireEvent.click(screen.getByLabelText('Marker symbol: Ring'));
  const popover = screen.getByRole('group', { name: 'Marker symbols' });
  expect(container.contains(popover)).toBe(false);
  expect(popover.parentElement).toBe(document.body);

  fireEvent.mouseDown(screen.getByRole('button', { name: 'Star' }));
  expect(screen.getByRole('group', { name: 'Marker symbols' })).toBeInTheDocument();

  fireEvent.scroll(window);
  expect(screen.queryByRole('group', { name: 'Marker symbols' })).not.toBeInTheDocument();
});
