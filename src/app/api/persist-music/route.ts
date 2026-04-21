import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

const BUCKET = "music";

let bucketReady = false;

async function ensureBucket() {
  const admin = createAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: true });
  }
}

function extFromContentType(ct: string | null | undefined): string {
  const v = (ct ?? "").toLowerCase();
  if (v.includes("mpeg") || v.includes("mp3")) return "mp3";
  if (v.includes("wav")) return "wav";
  if (v.includes("ogg")) return "ogg";
  if (v.includes("webm")) return "webm";
  if (v.includes("aac")) return "aac";
  if (v.includes("mp4") || v.includes("m4a")) return "m4a";
  return "mp3";
}

/**
 * Three modes, matching the patterns used by other persist/upload routes:
 *   1. JSON { musicUrl, projectId? } → download the http(s) URL (e.g. Fal.ai)
 *      and re-upload to our `music` bucket. Same shape as /api/persist-video.
 *   2. JSON { filename, contentType, projectId? } → return a signed upload URL
 *      so the client can PUT large MP3s directly to Supabase (bypasses Vercel's
 *      4.5MB body limit).
 *   3. multipart/form-data { file, projectId? } → legacy direct upload. Kept
 *      for small files (<4.5MB) so callers can stream a Blob straight in.
 * All responses return { url, path } (or signedUrl bundle) so the client can
 * store a stable Supabase URL on `project.metadata.musicUrl`.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!bucketReady) {
    await ensureBucket();
    bucketReady = true;
  }

  const contentTypeHeader = req.headers.get("content-type") ?? "";
  const isJson = contentTypeHeader.includes("application/json");

  if (isJson) {
    let body: {
      musicUrl?: string;
      filename?: string;
      contentType?: string;
      projectId?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { musicUrl, filename, contentType: fileContentType, projectId } = body;

    // Mode 1: mirror a remote URL (Fal.ai)
    if (musicUrl) {
      if (!musicUrl.startsWith("http")) {
        return NextResponse.json(
          { error: "musicUrl must be http(s)" },
          { status: 400 },
        );
      }

      try {
        const res = await fetch(musicUrl);
        if (!res.ok) {
          return NextResponse.json(
            { error: `Failed to download music: ${res.status}` },
            { status: 502 },
          );
        }

        const ct = res.headers.get("content-type") ?? "audio/mpeg";
        const ext = extFromContentType(ct);
        const blob = await res.blob();
        const path = `${user.id}/${projectId ?? "misc"}/${nanoid(10)}.${ext}`;

        const admin = createAdminClient();
        const { error } = await admin.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: ct, upsert: true });

        if (error) {
          console.error("[persist-music]", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const { data: urlData } = admin.storage
          .from(BUCKET)
          .getPublicUrl(path);
        return NextResponse.json({ url: urlData.publicUrl, path });
      } catch (err) {
        console.error("[persist-music]", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed" },
          { status: 500 },
        );
      }
    }

    // Mode 2: signed upload URL for large client-side files (>4.5MB safe)
    if (filename && fileContentType) {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "mp3";
      const path = `${user.id}/${projectId ?? "misc"}/${nanoid(10)}.${ext}`;

      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data) {
        console.error("[persist-music] signed url", error);
        return NextResponse.json(
          { error: error?.message ?? "Failed to create signed URL" },
          { status: 500 },
        );
      }

      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

      return NextResponse.json({
        signedUrl: data.signedUrl,
        token: data.token,
        path,
        publicUrl: urlData.publicUrl,
      });
    }

    return NextResponse.json(
      { error: "Provide either `musicUrl` (mirror) or `filename`+`contentType` (signed URL)" },
      { status: 400 },
    );
  }

  // Mode 3: multipart upload for small MP3s
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? extFromContentType(file.type);
  const path = `${user.id}/${projectId ?? "misc"}/${nanoid(10)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "audio/mpeg", upsert: true });

  if (error) {
    console.error("[persist-music]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl, path });
}
