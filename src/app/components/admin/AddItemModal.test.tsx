import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../../lib/database', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
  deleteImage: vi.fn().mockResolvedValue(undefined),
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

  it('advances to step 2 (Item Details) when Skip is clicked', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
    });
  });

  it('shows all required field labels in step 2', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/found location/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/found date/i)).toBeInTheDocument();
    });
  });

  it('progresses to step 3 summary after filling required fields', async () => {
    renderModal();

    // Advance to step 2
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByLabelText(/item name/i)).toBeInTheDocument());

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Test Laptop' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Silver laptop found in hallway' } });
    fireEvent.change(screen.getByLabelText(/found location/i), { target: { value: 'Main entrance' } });
    // foundDate is pre-filled with today; no change needed

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Test Laptop')).toBeInTheDocument();
    });
  });

  it('shows Add to Inventory button on step 3', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByLabelText(/item name/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Keys' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Ring of keys' } });
    fireEvent.change(screen.getByLabelText(/found location/i), { target: { value: 'Lobby' } });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to inventory/i })).toBeInTheDocument();
    });
  });
});
