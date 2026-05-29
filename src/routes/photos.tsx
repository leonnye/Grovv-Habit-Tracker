import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useDb, useMounted, ymd } from "@/lib/habits";
import { deletePhoto, listPhotos, uploadPhoto, type PhotoWithUrl } from "@/lib/photos";

export const Route = createFileRoute("/photos")({ component: PhotosPage });

function PhotosPage() {
  const mounted = useMounted();
  const auth = useAuth();
  const db = useDb();
  const configured = isSupabaseConfigured();

  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [habitId, setHabitId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<PhotoWithUrl | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    if (!configured || !auth.user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listPhotos();
      setPhotos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load photos.");
    } finally {
      setLoading(false);
    }
  }, [auth.user, configured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pendingFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  if (!mounted) return <AppShell>{null}</AppShell>;

  const handlePick = (file: File | null) => {
    setError(null);
    setPendingFile(file);
    setCaption("");
    setHabitId("");
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPhoto({
        file: pendingFile,
        caption,
        habitId: habitId || undefined,
        loggedOn: ymd(new Date()),
      });
      setPendingFile(null);
      setCaption("");
      setHabitId("");
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: PhotoWithUrl) => {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    try {
      await deletePhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      if (lightbox?.id === photo.id) setLightbox(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Photos"
        title={
          <>
            Your <span className="text-gradient">progress gallery</span>
          </>
        }
        subtitle="Snap a photo whenever you finish a habit — a meal, a workout, a journal page. Stored privately to your account."
      />

      {!configured ? (
        <NoticeCard
          title="Cloud sync isn't configured"
          body={
            <>
              Add your Supabase keys to <code>.env</code> and run the migration in{" "}
              <code>supabase/migrations</code> to enable photo uploads. Until then this tab is
              read-only.
            </>
          }
        />
      ) : !auth.user ? (
        <NoticeCard
          title="Sign in to use Photos"
          body="Photos are stored in your private account so they sync across devices. You can keep using the rest of Grovv without signing in."
          cta={
            <Link
              to="/account"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all"
            >
              Go to account
            </Link>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-[1fr_2fr] gap-4 lg:gap-6">
          <section className="rounded-2xl border border-border bg-[var(--surface)] p-5 sm:p-6 self-start">
            <h3 className="font-display text-base font-semibold">Add a photo</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-4">
              JPG, PNG, WEBP or HEIC, up to 8 MB.
            </p>

            <label className="block">
              <span className="sr-only">Choose photo</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:opacity-90"
              />
            </label>

            {preview && (
              <div className="mt-4">
                <div className="rounded-xl overflow-hidden border border-border bg-background">
                  <img
                    src={preview}
                    alt="Selected"
                    className="block w-full max-h-72 object-cover"
                  />
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="block text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                      Caption
                    </span>
                    <input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 140))}
                      placeholder="A line about this moment"
                      className="w-full rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-primary/60"
                    />
                  </label>
                  {db.habits.length > 0 && (
                    <label className="block">
                      <span className="block text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                        Link to habit (optional)
                      </span>
                      <select
                        value={habitId}
                        onChange={(e) => setHabitId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-primary/60"
                      >
                        <option value="">No link</option>
                        {db.habits.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.icon} {h.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => void handleUpload()}
                    className="flex-1 min-w-[10rem] rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:shadow-glow transition-all"
                  >
                    {uploading ? "Uploading…" : "Save photo"}
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      setPendingFile(null);
                      setCaption("");
                      setHabitId("");
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="rounded-full border border-border bg-[var(--surface-2)] px-5 py-3 text-sm font-semibold hover:border-primary/40 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-[color:var(--destructive)] break-words">{error}</p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display text-base font-semibold">
                Gallery
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {photos.length} photo{photos.length === 1 ? "" : "s"}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="text-xs text-primary font-semibold disabled:opacity-50"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {loading && photos.length === 0 ? (
              <div className="rounded-2xl border border-border bg-[var(--surface)] p-10 text-center text-sm text-muted-foreground">
                Loading your photos…
              </div>
            ) : photos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-[var(--surface)] p-10 text-center">
                <div className="text-4xl mb-2">📷</div>
                <p className="font-display text-sm font-semibold">Nothing yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the form on the left to upload your first photo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {photos.map((photo) => {
                  const habit = photo.habit_id
                    ? db.habits.find((h) => h.id === photo.habit_id)
                    : undefined;
                  return (
                    <button
                      type="button"
                      key={photo.id}
                      onClick={() => setLightbox(photo)}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-[var(--surface-2)] focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={photo.caption ?? "Progress photo"}
                          loading="lazy"
                          className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                          Photo unavailable
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                        <span className="block text-[0.65rem] font-semibold text-white truncate">
                          {photo.caption || (habit ? `${habit.icon} ${habit.name}` : "Untitled")}
                        </span>
                        <span className="block text-[0.6rem] text-white/70">
                          {new Date(photo.created_at).toLocaleDateString()}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {lightbox && (
        <Lightbox
          photo={lightbox}
          habitName={db.habits.find((h) => h.id === lightbox.habit_id)?.name}
          onClose={() => setLightbox(null)}
          onDelete={() => void handleDelete(lightbox)}
        />
      )}
    </AppShell>
  );
}

function NoticeCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: React.ReactNode;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--surface)] p-6 sm:p-8 text-center max-w-2xl">
      <div className="text-3xl mb-2">📸</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {cta && <div className="mt-5 flex justify-center">{cta}</div>}
    </div>
  );
}

function Lightbox({
  photo,
  habitName,
  onClose,
  onDelete,
}: {
  photo: PhotoWithUrl;
  habitName?: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-3xl border border-border bg-[var(--surface)] p-4 sm:p-5"
      >
        <div className="rounded-2xl overflow-hidden bg-background">
          {photo.signedUrl ? (
            <img
              src={photo.signedUrl}
              alt={photo.caption ?? "Progress photo"}
              className="block w-full max-h-[70vh] object-contain"
            />
          ) : (
            <div className="aspect-video grid place-items-center text-sm text-muted-foreground">
              Photo unavailable
            </div>
          )}
        </div>
        <div className="mt-4">
          {photo.caption && <p className="text-sm leading-relaxed">{photo.caption}</p>}
          <div className="mt-1 text-[0.7rem] text-muted-foreground">
            {new Date(photo.created_at).toLocaleString()}
            {habitName ? ` · ${habitName}` : ""}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-[color:var(--destructive)]/40 text-[color:var(--destructive)] px-5 py-2.5 text-sm font-semibold hover:bg-[color:var(--destructive)]/10 transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
