import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "videos";

let bucketReady = false;

async function ensureBucket() {
  const admin = createAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: true });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;

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

  try {
    const formData = await req.formData();
    const sprite = formData.get("sprite");
    const projectId = formData.get("projectId")?.toString();
    const sceneId = formData.get("sceneId")?.toString();

    if (!(sprite instanceof Blob) || !projectId || !sceneId) {
      return NextResponse.json(
        { error: "Missing fields: sprite, projectId, sceneId" },
        { status: 400 },
      );
    }

    const path = `${user.id}/${projectId}/sprites/${sceneId}.jpg`;
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, sprite, { contentType: "image/jpeg", upsert: true });

    if (error) {
      console.error("[persist-sprite]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl, path });
  } catch (err) {
    console.error("[persist-sprite]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
