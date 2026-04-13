import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

const BUCKET = "videos";

let bucketReady = false;

async function ensureBucket() {
  const admin = createAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: true });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { videoUrl, projectId, sceneId } = body as {
    videoUrl?: string;
    projectId?: string;
    sceneId?: string;
  };

  if (!videoUrl || !videoUrl.startsWith("http")) {
    return NextResponse.json(
      { error: "videoUrl is required and must be http(s)" },
      { status: 400 },
    );
  }

  if (!bucketReady) {
    await ensureBucket();
    bucketReady = true;
  }

  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      return NextResponse.json(
        { error: `Failed to download video: ${videoRes.status}` },
        { status: 502 },
      );
    }

    const contentType = videoRes.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.includes("webm") ? "webm" : "mp4";
    const blob = await videoRes.blob();
    const path = `${user.id}/${projectId ?? "misc"}/${sceneId ?? nanoid(8)}.${ext}`;

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, blob, { contentType, upsert: true });

    if (error) {
      console.error("[persist-video]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl, path });
  } catch (err) {
    console.error("[persist-video]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
