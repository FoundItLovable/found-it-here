import { describe, expect, it } from 'vitest';
import { shouldDefaultHidden } from './catalogVisibility';

describe('shouldDefaultHidden', () => {
  it('defaults hidden for always-hidden categories', () => {
    expect(shouldDefaultHidden('keys')).toBe(true);
    expect(shouldDefaultHidden('documents')).toBe(true);
    expect(shouldDefaultHidden('bags')).toBe(true);
    expect(shouldDefaultHidden('accessories')).toBe(true);
  });

  it('does not hide non-electronics categories outside hidden list', () => {
    expect(shouldDefaultHidden('clothing', 'Jacket')).toBe(false);
    expect(shouldDefaultHidden('other', 'Notebook')).toBe(false);
  });

  it('hides electronics with expensive-keyword match in name', () => {
    expect(shouldDefaultHidden('electronics', 'Apple MacBook Pro')).toBe(true);
    expect(shouldDefaultHidden('electronics', 'wireless earbuds')).toBe(true);
  });

  it('hides electronics with expensive-keyword match in description', () => {
    expect(shouldDefaultHidden('electronics', 'Unknown device', 'Found near hall, looks like an iPhone')).toBe(true);
  });

  it('does not hide electronics without expensive keywords', () => {
    expect(shouldDefaultHidden('electronics', 'HDMI cable', 'black cable')).toBe(false);
    expect(shouldDefaultHidden('electronics', 'USB adapter', 'small usb-c dongle')).toBe(false);
  });
});
