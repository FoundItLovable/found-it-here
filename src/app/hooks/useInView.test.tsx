import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInView } from './useInView';

type ObserverInstance = {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const instances: ObserverInstance[] = [];

function setupObserverMock() {
  class TestIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      instances.push({ callback, observe: this.observe, disconnect: this.disconnect });
    }
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: TestIntersectionObserver,
  });
}

function triggerIntersect(value: boolean) {
  const last = instances[instances.length - 1];
  last.callback([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver);
}

function HookView({ triggerOnce = true }: { triggerOnce?: boolean }) {
  const { ref, isInView } = useInView({ triggerOnce });
  return (
    <div>
      <div ref={ref}>target</div>
      <span data-testid="state">{String(isInView)}</span>
    </div>
  );
}

describe('useInView', () => {
  beforeEach(() => {
    instances.length = 0;
    setupObserverMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps true after first intersect when triggerOnce=true', () => {
    const { getByTestId } = render(<HookView triggerOnce />);

    act(() => triggerIntersect(true));
    expect(getByTestId('state').textContent).toBe('true');

    act(() => triggerIntersect(false));
    expect(getByTestId('state').textContent).toBe('true');
  });

  it('toggles with intersection changes when triggerOnce=false', () => {
    const { getByTestId } = render(<HookView triggerOnce={false} />);

    act(() => triggerIntersect(true));
    expect(getByTestId('state').textContent).toBe('true');

    act(() => triggerIntersect(false));
    expect(getByTestId('state').textContent).toBe('false');
  });
});
