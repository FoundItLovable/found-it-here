import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Smartphone, CheckCircle2, Camera } from "lucide-react";

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? "");
      const idx = data.indexOf(",");
      resolve(idx >= 0 ? data.slice(idx + 1) : data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function AdminMobileCapture() {
  const [params] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  const sessionId = useMemo(() => params.get("sessionId") ?? "", [params]);
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const staffId = useMemo(() => params.get("staffId") ?? "", [params]);
  const officeId = useMemo(() => params.get("officeId") ?? "", [params]);

  const valid = !!sessionId && !!token;

  useEffect(() => {
    doneRef.current = done;
  }, [done]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const onUpload = async () => {
    if (!file || !valid) return;
    setUploading(true);
    setError("");
    try {
      const base64 = await toBase64(file);
      const resp = await fetch(`/api/upload-sessions/${encodeURIComponent(sessionId)}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          staffId,
          officeId,
          filename: file.name,
          mimeType: file.type,
          base64,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Upload failed (${resp.status})`);
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const cancelSessionUpload = async () => {
    if (!valid) return;
    const resp = await fetch(`/api/upload-sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, staffId, officeId }),
      keepalive: true,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `Cancel failed (${resp.status})`);
    }
  };

  const openCamera = async () => {
    if (done) {
      setCanceling(true);
      try {
        await cancelSessionUpload();
        setDone(false);
      } catch (err: any) {
        setError(err?.message ?? "Could not reset previous upload");
        setCanceling(false);
        return;
      } finally {
        setCanceling(false);
      }
    }
    fileInputRef.current?.click();
  };

  const removePicture = async () => {
    if (uploading || canceling) return;
    setError("");
    if (done) {
      setCanceling(true);
      try {
        await cancelSessionUpload();
        setDone(false);
      } catch (err: any) {
        setError(err?.message ?? "Could not remove uploaded image");
      } finally {
        setCanceling(false);
      }
    }
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!valid) return;

    const cancelOnClose = () => {
      if (!doneRef.current) return;
      const body = JSON.stringify({ token, staffId, officeId });
      const blob = new Blob([body], { type: "application/json" });
      const url = `/api/upload-sessions/${encodeURIComponent(sessionId)}/cancel`;
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, blob);
        return;
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    };

    window.addEventListener("pagehide", cancelOnClose);
    return () => {
      window.removeEventListener("pagehide", cancelOnClose);
    };
  }, [valid, sessionId, token, staffId, officeId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Phone Capture Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!valid && <p className="text-sm text-destructive">Invalid or missing upload session link.</p>}

          {done ? (
            <div className="space-y-3 text-center py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto text-green-600" />
              <p className="font-medium">Upload Complete</p>
              <p className="text-sm text-muted-foreground">Photo uploaded successfully. Return to your desktop browser to continue.</p>
              {previewUrl && (
                <div className="rounded-md overflow-hidden border bg-muted text-left">
                  <img src={previewUrl} alt="Uploaded preview" className="w-full h-56 object-cover" />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Capture a photo with your device camera</Label>
                <Input
                  ref={fileInputRef}
                  id="mobile-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/*"
                  capture="environment"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={!valid || uploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void openCamera()}
                  disabled={!valid || uploading || canceling}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Picture
                </Button>
                {previewUrl && (
                  <div className="rounded-md overflow-hidden border bg-muted">
                    <img src={previewUrl} alt="Captured preview" className="w-full h-56 object-cover" />
                  </div>
                )}
                {file && <p className="text-sm text-muted-foreground">Ready: {file.name}</p>}
                {file && (
                  <Button type="button" variant="outline" className="w-full" onClick={() => void removePicture()} disabled={uploading || canceling}>
                    {canceling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Removing...</> : "Remove Picture"}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">JPEG or PNG, up to 10MB.</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={onUpload} className="w-full" disabled={!valid || !file || uploading || canceling}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : "Upload to Desktop Session"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
