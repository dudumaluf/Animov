import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

const BUCKET = "photos";

async function ensureBucket() {
  const admin = createAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: true });
  }
}

let bucketReady = false;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!bucketReady) {
    await ensureBucket();
    bucketReady = true;
  }

  // Two modes:
  // 1. JSON body -> return signed upload URL (client PUTs directly to Supabase,
  //    bypasses Vercel 4.5MB body limit for large photos)
  // 2. multipart/form-data -> legacy in-function upload (kept for back-compat
  //    with any caller that still sends a File; will fail on Vercel for
  //    photos > 4.5MB)
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    let body: { filename?: string; contentType?: string; projectId?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { filename, contentType: fileContentType, projectId } = body;
    if (!filename || !fileContentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 },
      );
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${projectId ?? "misc"}/${nanoid(8)}.${ext}`;

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("[upload] signed url error", error);
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

  // Legacy multipart path. Kept so older client code doesn't silently break,
  // but this path is bounded by Vercel's 4.5MB request body limit.
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${projectId ?? "misc"}/${nanoid(8)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[upload]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl, path });
}
