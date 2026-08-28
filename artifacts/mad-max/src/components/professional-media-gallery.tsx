import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Loader2, Trash2, Upload, Video, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

export type ProfessionalMedia = {
  id: number;
  mediaType: "photo" | "video";
  mediaUrl: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
};

type ProfessionalMediaGalleryProps = {
  media: ProfessionalMedia[];
  editable?: boolean;
  onChanged?: () => void | Promise<void>;
};

const MAX_MEDIA_SIZE = 100 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadToSignedUrl(url: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("File upload failed."));
    });
    request.addEventListener("error", () => reject(new Error("File upload failed.")));
    request.addEventListener("abort", () => reject(new Error("File upload was cancelled.")));
    request.send(file);
  });
}

function MediaTile({ item, editable, onDelete }: { item: ProfessionalMedia; editable: boolean; onDelete: (id: number) => void }) {
  return (
    <article className="group relative overflow-hidden rounded-md border border-border bg-card">
      <div className="aspect-[4/3] bg-background">
        {item.mediaType === "photo" ? (
          <img
            src={item.mediaUrl}
            alt={`Portfolio photo: ${item.fileName}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <video
            src={item.mediaUrl}
            controls
            preload="metadata"
            aria-label={`Portfolio video: ${item.fileName}`}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{item.fileName}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{formatFileSize(item.fileSize)}</p>
        </div>
        {editable && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${item.fileName}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </article>
  );
}

function MediaSection({
  title,
  description,
  items,
  icon: Icon,
  editable,
  uploading,
  uploadProgress,
  onChoose,
  onDelete,
}: {
  title: string;
  description: string;
  items: ProfessionalMedia[];
  icon: LucideIcon;
  editable: boolean;
  uploading: boolean;
  uploadProgress: number;
  onChoose: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <section className="space-y-4" data-testid={`profile-media-section-${title.toLowerCase()}`}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wider">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {editable && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onChoose}
            disabled={uploading}
            className="gap-2"
            data-testid={`button-upload-${title.toLowerCase()}`}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? `${uploadProgress}% uploading` : `Add ${title.toLowerCase()}`}
          </Button>
        )}
      </div>
      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <MediaTile key={item.id} item={item} editable={editable} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-6 py-10 text-center" data-testid={`profile-media-empty-${title.toLowerCase()}`}>
          <Icon className="mx-auto h-8 w-8 text-primary/70" />
          <p className="mt-3 font-display text-sm font-bold uppercase tracking-wider">No {title.toLowerCase()} yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {editable ? `Share your ${title.toLowerCase()} work here so your professional profile tells your story.` : `This profile has not added any ${title.toLowerCase()} work yet.`}
          </p>
        </div>
      )}
    </section>
  );
}

export function ProfessionalMediaGallery({ media, editable = false, onChanged }: ProfessionalMediaGalleryProps) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<"photo" | "video" | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleUpload = async (file: File | undefined, mediaType: "photo" | "video", input: HTMLInputElement) => {
    if (!file) return;
    input.value = "";
    setError(null);
    if (file.size <= 0 || file.size > MAX_MEDIA_SIZE) {
      setError("Choose an image or video up to 100MB.");
      return;
    }
    const expectedType = mediaType === "photo" ? "image/" : "video/";
    if (!file.type.startsWith(expectedType)) {
      setError(`Choose a ${mediaType === "photo" ? "photo" : "video"} file.`);
      return;
    }

    setUploadingType(mediaType);
    setUploadProgress(0);
    let objectPath: string | null = null;
    try {
      const urlResponse = await fetch("/api/professionals/me/media/request-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const signed = await urlResponse.json().catch(() => null);
      if (!urlResponse.ok) throw new Error(signed?.error || "Could not prepare the upload.");
      objectPath = signed.objectPath;
      await uploadToSignedUrl(signed.uploadURL, file, setUploadProgress);

      const saveResponse = await fetch("/api/professionals/me/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      const saved = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(saved?.error || "Could not save this media.");
      await onChanged?.();
    } catch (uploadError) {
      if (objectPath) {
        await fetch("/api/professionals/me/media/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath }),
        }).catch(() => undefined);
      }
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload this media.");
    } finally {
      setUploadingType(null);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this portfolio media?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/professionals/me/media/${id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Could not delete this media.");
      await onChanged?.();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this media.");
    } finally {
      setDeletingId(null);
    }
  };

  const photos = media.filter((item) => item.mediaType === "photo");
  const videos = media.filter((item) => item.mediaType === "video");
  const activeUpload = uploadingType !== null;

  return (
    <div className="space-y-10" data-testid="professional-media-gallery">
      <input ref={photoInput} type="file" accept="image/*" className="sr-only" onChange={(event) => void handleUpload(event.target.files?.[0], "photo", event.target)} />
      <input ref={videoInput} type="file" accept="video/*" className="sr-only" onChange={(event) => void handleUpload(event.target.files?.[0], "video", event.target)} />
      <MediaSection
        title="Photos"
        description="Portraits, stills, behind-the-scenes frames, and visual references."
        items={photos}
        icon={ImageIcon}
        editable={editable}
        uploading={uploadingType === "photo"}
        uploadProgress={uploadProgress}
        onChoose={() => photoInput.current?.click()}
        onDelete={(id) => void handleDelete(id)}
      />
      <MediaSection
        title="Videos"
        description="Reels, scenes, set footage, and work samples."
        items={videos}
        icon={Video}
        editable={editable}
        uploading={uploadingType === "video"}
        uploadProgress={uploadProgress}
        onChoose={() => videoInput.current?.click()}
        onDelete={(id) => void handleDelete(id)}
      />
      {activeUpload && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Keep this page open while the file finishes uploading.
        </p>
      )}
      {deletingId !== null && (
        <p className="text-xs text-muted-foreground" role="status">Removing media…</p>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}