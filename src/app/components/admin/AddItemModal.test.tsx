import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockToast = vi.fn();

vi.mock('../../../lib/database', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./MapPinPicker', () => ({
  MapPinPicker: ({ onSelect }: { onSelect: (lat: number, lng: number, address?: string) => void }) => (
    <button type="button" onClick={() => onSelect(40.0076, -105.2669, 'Campus Center')}>
      Use Test Pin
    </button>
  ),
}));

import { AddItemModal } from './AddItemModal';
import { uploadImage } from '../../../lib/database';

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
    mockToast.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
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

  it('blocks unsupported image types before upload', async () => {
    renderModal();
    const fileInput = document.querySelector('input[type="file"][accept*=".jpg"]') as HTMLInputElement;
    const heicFile = new File(['fake'], 'photo.heic', { type: 'image/heic' });

    fireEvent.change(fileInput, { target: { files: [heicFile] } });

    await waitFor(() => {
      expect(uploadImage).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Unsupported image type' })
      );
    });
  });

  it('blocks oversized files before upload', async () => {
    renderModal();
    const fileInput = document.querySelector('input[type="file"][accept*=".jpg"]') as HTMLInputElement;
    const largeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(uploadImage).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'File too large' })
      );
    });
  });

  it('shows AI quota toast on analyze 429 response', async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,ZmFrZQ==';
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }

    vi.stubGlobal('FileReader', MockFileReader as any);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ details: 'rate limited' }),
      })
    );

    renderModal();
    const fileInput = document.querySelector('input[type="file"][accept*=".jpg"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'AI quota exceeded' })
      );
    });
  });

  it('submits normalized payload including cleaned color and coordinates', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddItemModal
        open
        onOpenChange={noop}
        onSubmit={onSubmit}
        staffId="staff-1"
        officeId="office-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /use test pin/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /use test pin/i }));
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => expect(screen.getByLabelText(/item name/i)).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Campus Watch' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Found near stairs' } });
    fireEvent.change(screen.getByLabelText(/color/i), { target: { value: ' Black / silver ; BLACK ' } });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /add to inventory/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add to inventory/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Campus Watch',
          description: 'Found near stairs',
          color: 'black,silver',
          latitude: 40.0076,
          longitude: -105.2669,
        })
      );
    });
  }, 10000);
});
