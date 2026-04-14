import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

const BUCKET = "videos";

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

  const body = await req.json();
  const { filename, contentType, projectId } = body as {
    filename?: string;
    contentType?: string;
    projectId?: string;
  };

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "filename and contentType are required" },
      { status: 400 },
    );
  }

  const ext = filename.split(".").pop() ?? "mp4";
  const path = `${user.id}/${projectId ?? "misc"}/${nanoid(8)}.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[upload-video] signed url error", error);
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
