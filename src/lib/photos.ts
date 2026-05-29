import { getSupabase, PHOTOS_BUCKET, type PhotoRow } from "./supabase";

export type PhotoWithUrl = PhotoRow & { signedUrl: string };

export type UploadPhotoArgs = {
  file: File;
  caption?: string;
  habitId?: string;
  loggedOn?: string;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"]);

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

function extFromFile(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/heic") return "heic";
  return "bin";
}

export async function uploadPhoto({
  file,
  caption,
  habitId,
  loggedOn,
}: UploadPhotoArgs): Promise<PhotoRow> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud sync is not configured.");
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("You need to be signed in to upload photos.");

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, WEBP, GIF or HEIC images are supported.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Photo is too large — please pick something under 8 MB.");
  }

  const id = crypto.randomUUID();
  const ext = extFromFile(file);
  const path = `${user.id}/${id}.${ext}`;

  const upload = await sb.storage.from(PHOTOS_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);

  const insert = await sb
    .from("photos")
    .insert({
      id,
      user_id: user.id,
      storage_path: path,
      caption: caption?.trim() ? caption.trim().slice(0, 140) : null,
      habit_id: habitId ?? null,
      logged_on: loggedOn,
    })
    .select()
    .single();

  if (insert.error) {
    await sb.storage.from(PHOTOS_BUCKET).remove([path]);
    throw new Error(insert.error.message);
  }
  return insert.data as PhotoRow;
}

export async function listPhotos(): Promise<PhotoWithUrl[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session?.user) return [];

  const { data, error } = await sb
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PhotoRow[];
  if (rows.length === 0) return [];

  const signed = await sb.storage.from(PHOTOS_BUCKET).createSignedUrls(
    rows.map((r) => r.storage_path),
    60 * 60,
  );
  if (signed.error) throw new Error(signed.error.message);

  const urlByPath = new Map<string, string>();
  for (const entry of signed.data ?? []) {
    if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
  }
  return rows.map((row) => ({
    ...row,
    signedUrl: urlByPath.get(row.storage_path) ?? "",
  }));
}

export async function deletePhoto(photo: Pick<PhotoRow, "id" | "storage_path">): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud sync is not configured.");
  await sb.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
  const { error } = await sb.from("photos").delete().eq("id", photo.id);
  if (error) throw new Error(error.message);
}
