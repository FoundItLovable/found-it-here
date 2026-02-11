import { useEffect, useMemo, useRef, useState } from 'react';
import { ItemCategory, categoryLabels } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Camera, X, Loader2, ChevronRight, ChevronLeft, QrCode, Link as LinkIcon, Smartphone, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteImage, uploadImage } from '../../.././lib/database';
import { mapCategory } from '../../data/categoryMap';

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId?: string;
  officeId?: string;
  initialData?: Partial<{
    name: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string;
    foundLocation?: string;
    color?: string;
    brand?: string;
    foundDate?: string;
    highValue?: boolean;
  }>;
  onSubmit: (data: {
    name: string;
    description: string;
    category: ItemCategory;
    imageUrl?: string;
    foundLocation?: string;
    color?: string;
    brand?: string;
    foundDate?: string;
    highValue?: boolean;
  }) => Promise<void> | void;
}

type UploadTab = 'camera' | 'file' | 'phone';

type UploadSessionState = {
  sessionId: string;
  token: string;
  expiresAt: number;
  mobileUrl: string;
};

const normalizeColorList = (value: string): string =>
  Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[;,/|]+/g)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  ).join(',');

const todayLocalISO = () => new Date().toLocaleDateString('en-CA');

const initialFormState = () => ({
  name: '',
  description: '',
  category: 'other' as ItemCategory,
  imageUrl: '',
  imagePreview: null as string | null,
  foundLocation: '',
  color: '',
  brand: '',
  foundDate: todayLocalISO(),
  highValue: false,
});

// Browsers can't render HEIC/HEIF; allow only PNG/JPEG
const supportedMimeTypes = ['image/jpeg', 'image/png'];
const supportedExtensions = ['jpg', 'jpeg', 'png'];

const isSupportedImage = (file: File) => {
  const type = file.type?.toLowerCase();
  if (supportedMimeTypes.includes(type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? supportedExtensions.includes(ext) : false;
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? '');
      const idx = data.indexOf(',');
      resolve(idx >= 0 ? data.slice(idx + 1) : data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function AddItemModal({ open, onOpenChange, onSubmit, initialData, staffId = '', officeId = '' }: AddItemModalProps) {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTab, setUploadTab] = useState<UploadTab>('file');
  const [qrSession, setQrSession] = useState<UploadSessionState | null>(null);
  const [qrStatus, setQrStatus] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraFallbackInputRef = useRef<HTMLInputElement>(null);
  const qrPollRef = useRef<number | null>(null);
  const qrConsumedRef = useRef(false);
  const cleanupRanRef = useRef(false);
  const previousOpenRef = useRef(open);

  const [formData, setFormData] = useState(initialFormState);
  const qrImageSrc = useMemo(() => {
    if (!qrSession?.mobileUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrSession.mobileUrl)}`;
  }, [qrSession?.mobileUrl]);

  const cleanupUploadedImage = async (url: string) => {
    if (!url) return;
    try {
      await deleteImage(url);
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  // (initialData is synced into form when modal opens further below)
  const clearQrPolling = () => {
    if (qrPollRef.current) {
      window.clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
  };

  const processSelectedFile = async (file: File) => {
    if (!file) return;
    if (!isSupportedImage(file)) {
      toast({
        title: 'Unsupported image type',
        description: 'Please upload a JPG or PNG image.',
        variant: 'destructive'
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image under 10MB', variant: 'destructive' });
      return;
    }

    setSelectedFile(file);
    setAnalysisDone(false);
    const previewBase64 = await toBase64(file);
    setFormData((p) => ({ ...p, imagePreview: `data:${file.type};base64,${previewBase64}` }));

    setUploading(true);
    try {
      const previousImageUrl = formData.imageUrl;
      const url = await uploadImage(file);
      setFormData((p) => ({ ...p, imageUrl: url }));
      toast({ title: 'Image uploaded', description: 'Your image has been uploaded successfully. Click Analyze to continue.' });
      if (previousImageUrl && previousImageUrl !== url) {
        void cleanupUploadedImage(previousImageUrl);
      }
    } catch (err: any) {
      console.error(err);
      setFormData((p) => ({ ...p, imagePreview: null }));
      setSelectedFile(null);
      setAnalysisDone(false);
      toast({ title: 'Upload failed', description: err?.message ?? 'Could not upload image.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
  };


  const createQrSession = async () => {
    if (!staffId || !officeId) {
      setQrStatus('Staff/office context missing. Reload admin page and try again.');
      return;
    }
    setQrLoading(true);
    setQrStatus('Creating phone upload session...');
    try {
      const resp = await fetch('/api/upload-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, officeId }),
      });
      if (!resp.ok) throw new Error(`Session request failed (${resp.status})`);
      const data = await resp.json();
      setQrSession({
        sessionId: String(data.sessionId),
        token: String(data.token),
        expiresAt: Number(data.expiresAt),
        mobileUrl: String(data.mobileUrl),
      });
      qrConsumedRef.current = false;
      setQrStatus('Scan with your phone, capture a photo, and submit.');
    } catch (err: any) {
      console.error('QR session create error', err);
      setQrStatus(err?.message ?? 'Could not create phone session.');
    } finally {
      setQrLoading(false);
    }
  };

  const applyPhoneUploadedImage = async (imageUrl: string) => {
    const previousImageUrl = formData.imageUrl;
    setSelectedFile(null);
    setAnalysisDone(false);
    setFormData((p) => ({ ...p, imageUrl, imagePreview: imageUrl }));
    setQrStatus('Image received from phone.');
    toast({ title: 'Phone upload received', description: 'Image is ready. Click Analyze or Skip.' });
    if (previousImageUrl && previousImageUrl !== imageUrl) {
      void cleanupUploadedImage(previousImageUrl);
    }
  };

  const handleAnalyzeImage = async () => {
    if (uploading) return;
    if (!formData.imageUrl) {
      toast({ title: 'Image still uploading', description: 'Wait for upload to finish before analyzing.' });
      return;
    }

    setAnalyzing(true);
    toast({ title: 'Analyzing image', description: 'AI analysis in progress...' });

    try {
      const resp = selectedFile
        ? await (async () => {
            const base64 = await toBase64(selectedFile);
            return fetch('/api/gemini/analyze-file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: selectedFile.name, mimeType: selectedFile.type, base64 }),
            });
          })()
        : await fetch('/api/gemini/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: formData.imageUrl }),
          });

      if (resp.ok) {
        const data = await resp.json();
        setFormData((prev) => {
          const next = { ...prev };
          if (!prev.name?.trim() && data.name) next.name = data.name;
          if (!prev.description?.trim() && data.description) next.description = data.description;
          if ((!prev.category || prev.category === 'other') && data.category) {
            const mapped = mapCategory(data.category);
            if (mapped) next.category = mapped as ItemCategory;
            else next.category = (data.category as ItemCategory) ?? prev.category;
          }
          if (!prev.color?.trim() && data.color) next.color = normalizeColorList(data.color);
          if (!prev.brand?.trim() && data.brand) next.brand = data.brand;
          if (!prev.foundLocation?.trim() && data.foundLocation) next.foundLocation = data.foundLocation;
          if (!prev.foundDate?.trim() && data.foundDate && /^\d{4}-\d{2}-\d{2}$/.test(data.foundDate)) next.foundDate = data.foundDate;
          if (data.highValue === true) next.highValue = true;
          return next;
        });
        toast({ title: 'AI analysis applied', description: 'Fields were pre-filled. Please verify before submitting.' });
      } else {
        console.warn('AI analyze returned non-OK', resp.status);
        toast({ title: 'AI analysis failed', description: 'Could not parse the image. You can fill fields manually.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('AI analyze error:', err);
      toast({ title: 'AI analysis failed', description: 'Could not parse the image. You can fill fields manually.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
      setAnalysisDone(true);
    }
  };

  const handleRemoveImage = () => {
    const imageUrlToDelete = formData.imageUrl;
    setFormData((p) => ({ ...p, imageUrl: '', imagePreview: null }));
    setSelectedFile(null);
    setAnalysisDone(false);
    setAnalyzing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraFallbackInputRef.current) cameraFallbackInputRef.current.value = '';
    if (imageUrlToDelete) void cleanupUploadedImage(imageUrlToDelete);
  };

  const handleNext = () => {
    if (step === 1 && uploading) return;
    if (step === 2) {
      if (!formData.name.trim() || !formData.description.trim() || !formData.foundLocation.trim() || !formData.foundDate.trim()) {
        toast({
          title: 'Missing information',
          description: 'Item name, description, found location, and found date are required.',
          variant: 'destructive'
        });
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleFinalSubmit = async () => {
    if (!formData.name.trim() || !formData.description.trim() || !formData.foundLocation.trim() || !formData.foundDate.trim()) {
      toast({
        title: 'Missing information',
        description: 'Item name, description, found location, and found date are required.',
        variant: 'destructive'
      });
      return;
    }
    setSubmitting(true);
    try {
      const cleanedColor = normalizeColorList(formData.color);
      await onSubmit({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        imageUrl: formData.imageUrl || undefined,
        foundLocation: formData.foundLocation || undefined,
        color: cleanedColor || undefined,
        brand: formData.brand || undefined,
        foundDate: formData.foundDate,
        highValue: formData.highValue,
      });
      handleOpenChange(false, { keepImage: true });
    } catch (e) {
      // parent handles errors
    } finally {
      setSubmitting(false);
    }
  };

  const performCleanup = (keepImage: boolean) => {
    const imageUrlToDelete = keepImage ? '' : formData.imageUrl;
    setFormData(initialFormState());
    setSelectedFile(null);
    setAnalysisDone(false);
    setAnalyzing(false);
    setUploadTab('file');
    clearQrPolling();
    setQrSession(null);
    setQrStatus('');
    setStep(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraFallbackInputRef.current) cameraFallbackInputRef.current.value = '';
    if (imageUrlToDelete) void cleanupUploadedImage(imageUrlToDelete);
    cleanupRanRef.current = true;
  };

  const handleOpenChange = (v: boolean, options?: { keepImage?: boolean }) => {
    if (!v) {
      performCleanup(!!options?.keepImage);
    } else {
      cleanupRanRef.current = false; // opening
    }
    onOpenChange(v);
  };

  useEffect(() => {
    if (uploadTab !== 'phone' || !qrSession) {
      clearQrPolling();
      return;
    }

    const poll = async () => {
      try {
        const resp = await fetch(
          `/api/upload-sessions/${encodeURIComponent(qrSession.sessionId)}/status?token=${encodeURIComponent(qrSession.token)}&staffId=${encodeURIComponent(staffId)}&officeId=${encodeURIComponent(officeId)}`
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.status === 'uploaded' && data.imageUrl) {
          await applyPhoneUploadedImage(String(data.imageUrl));
          if (!qrConsumedRef.current) {
            qrConsumedRef.current = true;
            await fetch(`/api/upload-sessions/${encodeURIComponent(qrSession.sessionId)}/consume`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: qrSession.token, staffId, officeId }),
            });
          }
          clearQrPolling();
        }
      } catch (err) {
        console.error('QR polling error:', err);
      }
    };

    void poll();
    qrPollRef.current = window.setInterval(() => {
      void poll();
    }, 1500);

    return () => {
      clearQrPolling();
    };
  }, [uploadTab, qrSession, staffId, officeId]);

  // If parent closes the modal without going through handleOpenChange (e.g., route change),
  // still clean up any uploaded image.
  useEffect(() => {
    if (previousOpenRef.current && !open && !cleanupRanRef.current) {
      performCleanup(false);
    }
    if (!previousOpenRef.current && open) {
      cleanupRanRef.current = false;
    }
    previousOpenRef.current = open;
  }, [open]);

  // On unmount, delete any uploaded image that wasn't kept
  useEffect(() => {
    return () => {
      clearQrPolling();
      if (formData.imageUrl && !cleanupRanRef.current) {
        void cleanupUploadedImage(formData.imageUrl);
      }
    };
  }, [formData.imageUrl]);

  // sync initialData into form only when modal opens / initialData changes
  useEffect(() => {
    if (!open || !initialData) return;
    setFormData((prev) => ({
      ...prev,
      name: initialData.name ?? prev.name,
      description: initialData.description ?? prev.description,
      category: (initialData.category as ItemCategory) ?? prev.category,
      imageUrl: initialData.imageUrl ?? prev.imageUrl,
      imagePreview: initialData.imageUrl ?? prev.imagePreview,
      foundLocation: initialData.foundLocation ?? prev.foundLocation,
      color: initialData.color ?? prev.color,
      brand: initialData.brand ?? prev.brand,
      foundDate: initialData.foundDate ?? prev.foundDate,
      highValue: initialData.highValue ?? prev.highValue,
    }));
  }, [open, initialData]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add Found Item</DialogTitle>
          <DialogDescription>Step {step} of 3 - {step === 1 ? 'Upload Photo' : step === 2 ? 'Item Details' : 'Review'}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Item Photo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraFallbackInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Tabs
              value={uploadTab}
              onValueChange={(value) => {
                const next = value as UploadTab;
                setUploadTab(next);
                if (next === 'phone' && !qrSession && !qrLoading && open) {
                  void createQrSession();
                }
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="camera" className="flex items-center gap-2"><Camera className="w-4 h-4" />Camera</TabsTrigger>
                <TabsTrigger value="file" className="flex items-center gap-2"><Upload className="w-4 h-4" />Upload File</TabsTrigger>
                <TabsTrigger value="phone" className="flex items-center gap-2"><QrCode className="w-4 h-4" />Phone via QR</TabsTrigger>
              </TabsList>

              <TabsContent value="camera" className="mt-4 h-[420px]">
                <div className="space-y-3 rounded-lg border border-border/60 p-4 bg-muted/20 h-full flex flex-col">
                  <div className="relative rounded-lg overflow-hidden w-full aspect-square bg-muted">
                    {formData.imagePreview ? (
                      <>
                        <img src={formData.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={handleRemoveImage}
                          disabled={uploading || analyzing}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        {uploading && <div className="absolute inset-0 bg-background/80 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
                        Photo preview will appear here after capture.
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Open your device camera app to capture a photo and upload it directly.
                  </p>
                  <Button type="button" onClick={() => cameraFallbackInputRef.current?.click()} className="mt-auto">
                    <Smartphone className="w-4 h-4 mr-2" />Use Device Camera App
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="file" className="mt-4 h-[420px]">
                <div className="space-y-3 rounded-lg border border-border/60 p-4 bg-muted/20 h-full flex flex-col">
                  <div className="relative rounded-lg overflow-hidden w-full aspect-square bg-muted">
                    {formData.imagePreview ? (
                      <>
                        <img src={formData.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={handleRemoveImage}
                          disabled={uploading || analyzing}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        {uploading && <div className="absolute inset-0 bg-background/80 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
                        Photo preview will appear here after upload.
                      </div>
                    )}
                  </div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-background/70"
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="phone" className="mt-4 h-[360px]">
                <div className="rounded-lg border border-border/60 p-4 bg-muted/20 h-full flex flex-col gap-3">
                  <div className="relative rounded-lg overflow-hidden w-full max-w-[220px] aspect-square bg-muted mx-auto shrink-0">
                    {formData.imagePreview ? (
                      <>
                        <img src={formData.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={handleRemoveImage}
                          disabled={uploading || analyzing}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        {uploading && <div className="absolute inset-0 bg-background/80 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
                      </>
                    ) : (
                      <>
                        {qrImageSrc ? (
                          <img src={qrImageSrc} alt="Phone upload QR code" className="w-full h-full object-contain bg-white p-3" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
                            {qrLoading ? 'Preparing QR code...' : 'Waiting for phone upload.'}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {!formData.imagePreview ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Open this session on your phone, capture with your device camera, and submit.
                      </p>
                      {qrStatus && <p className="text-sm text-muted-foreground">{qrStatus}</p>}
                      <div className="flex flex-wrap gap-2 justify-center mt-auto">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            if (!qrSession?.mobileUrl) return;
                            await navigator.clipboard.writeText(qrSession.mobileUrl);
                            toast({ title: 'Link copied', description: 'Phone capture link copied to clipboard.' });
                          }}
                          disabled={!qrSession?.mobileUrl}
                        >
                          <LinkIcon className="w-4 h-4 mr-2" />Copy Link
                        </Button>
                        <Button type="button" variant="outline" onClick={createQrSession} disabled={qrLoading}>
                          {qrLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}New Session
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Phone upload received. You can now analyze this image or continue.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              {formData.imagePreview ? (
                analysisDone ? (
                  <Button onClick={handleNext}>Continue <ChevronRight className="w-4 h-4 ml-2" /></Button>
                ) : (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={handleNext}>
                      Skip
                    </Button>
                    <Button type="button" onClick={handleAnalyzeImage} disabled={uploading || analyzing || !formData.imageUrl || analysisDone}>
                      {analyzing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Waiting</>) : 'Analyze'}
                    </Button>
                  </>
                )
              ) : (
                <Button onClick={handleNext}>Skip <ChevronRight className="w-4 h-4 ml-2" /></Button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Item Name *</Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g., Black iPhone"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="bg-background border-border/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v as ItemCategory }))}>
                  <SelectTrigger className="bg-background border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(categoryLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
                <Textarea
                  id="description"
                  required
                  placeholder="Describe the item in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="bg-background border-border/50 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color" className="text-sm font-medium">Color</Label>
                <Input id="color" placeholder="e.g., Black" value={formData.color} onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))} className="bg-background border-border/50" />
                <p className="text-xs text-muted-foreground">
                  Enter multiple colors as a comma-separated list with no spaces (example: black,silver,blue).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand" className="text-sm font-medium">Brand</Label>
                <Input id="brand" placeholder="e.g., Apple" value={formData.brand} onChange={(e) => setFormData((p) => ({ ...p, brand: e.target.value }))} className="bg-background border-border/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="foundLocation" className="text-sm font-medium">Found Location *</Label>
                <Input
                  id="foundLocation"
                  required
                  placeholder="e.g., Main entrance"
                  value={formData.foundLocation}
                  onChange={(e) => setFormData((p) => ({ ...p, foundLocation: e.target.value }))}
                  className="bg-background border-border/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="foundDate" className="text-sm font-medium">Found Date *</Label>
                <Input
                  id="foundDate"
                  type="date"
                  required
                  value={formData.foundDate}
                  onChange={(e) => setFormData((p) => ({ ...p, foundDate: e.target.value }))}
                  className="bg-background border-border/50"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={handleBack}><ChevronLeft className="w-4 h-4 mr-2" />Back</Button>
              <Button onClick={handleNext}>Continue<ChevronRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <div className="flex items-start gap-3">
                <Checkbox id="highValue" checked={formData.highValue} onCheckedChange={(checked) => setFormData((p) => ({ ...p, highValue: checked as boolean }))} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="highValue" className="font-medium cursor-pointer">Mark as High Value / Personal Information</Label>
                  <p className="text-sm text-muted-foreground mt-1">Check this box if the item contains sensitive information or has significant monetary value. This will flag it for special handling.</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border border-border/50">
              <h4 className="font-semibold text-sm mb-3">Summary</h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{formData.name}</span></div>
                <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{categoryLabels[formData.category]}</span></div>
                {formData.imagePreview && <div><span className="text-muted-foreground">Photo:</span> <span className="font-medium">Yes</span></div>}
                {formData.highValue && <div><span className="text-destructive">High Value Item</span></div>}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleBack} disabled={submitting}><ChevronLeft className="w-4 h-4 mr-2" />Back</Button>
              <Button onClick={handleFinalSubmit} disabled={submitting}>
                {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>) : (<><Upload className="w-4 h-4 mr-2" />Add to Inventory</>)}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
