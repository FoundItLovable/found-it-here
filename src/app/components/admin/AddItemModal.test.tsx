import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../../lib/database', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./MapPinPicker', () => ({
  MapPinPicker: ({ onSelect }: { onSelect: (lat: number, lng: number, address?: string) => void }) => (
    <button type="button" onClick={() => onSelect(40.0076, -105.2669, 'Campus Center')}>
      Use Test Pin
    </button>
  ),
}));

import { AddItemModal } from './AddItemModal';

const noop = vi.fn();

function renderModal(open = true) {
  return render(
    <AddItemModal
      open={open}
      onOpenChange={noop}
      onSubmit={noop}
      staffId="staff-1"
      officeId="office-1"
    />
  );
}

describe('AddItemModal', () => {
  beforeEach(() => {
    noop.mockClear();
  });

  it('renders nothing visible when closed', () => {
    renderModal(false);
    expect(screen.queryByText('Add Found Item')).not.toBeInTheDocument();
  });

  it('shows dialog title and step 1 (Upload Photo) when open', () => {
    renderModal();
    expect(screen.getByText('Add Found Item')).toBeInTheDocument();
    expect(screen.getByText(/Upload Photo/i)).toBeInTheDocument();
  });

  it('shows Cancel and Skip buttons on step 1', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('advances to step 2 (Pin Location) when Skip is clicked', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => {
      expect(screen.getByText(/step 2 of 4 - pin location/i)).toBeInTheDocument();
    });
  });

  it('shows map pin action on step 2', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /use test pin/i })).toBeInTheDocument();
    });
  });

  it('progresses to step 4 summary after pinning location, analyzing, and filling required fields', async () => {
    renderModal();

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /use test pin/i })).toBeInTheDocument());

    // Pin location and analyze (acts as continue with buffer)
    fireEvent.click(screen.getByRole('button', { name: /use test pin/i }));
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));
    await waitFor(() => expect(screen.getByLabelText(/item name/i)).toBeInTheDocument(), { timeout: 4000 });

    // Fill required fields on details step
    fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Test Laptop' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Silver laptop found in hallway' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Test Laptop')).toBeInTheDocument();
    });
  });

  it('shows Add to Inventory button on step 3', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /use test pin/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /use test pin/i }));
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));
    await waitFor(() => expect(screen.getByLabelText(/item name/i)).toBeInTheDocument(), { timeout: 4000 });

    fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Keys' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Ring of keys' } });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to inventory/i })).toBeInTheDocument();
    });
  });
});
