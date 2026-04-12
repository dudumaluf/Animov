import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/kling-video/o1/image-to-video";

async function ensureFalUrl(url: string): Promise<string> {
  if (url.startsWith("https://") && !url.startsWith("data:")) {
    return url;
  }

  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], "frame.jpg", { type: blob.type || "image/jpeg" });
  return fal.storage.upload(file);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { startImageUrl, endImageUrl, duration = 3 } = body;

  if (!startImageUrl || !endImageUrl) {
    return NextResponse.json(
      { error: "startImageUrl and endImageUrl are required" },
      { status: 400 },
    );
  }

  try {
    console.log(`[generate-transition] uploading frames to fal.ai storage...`);
    const [falStartUrl, falEndUrl] = await Promise.all([
      ensureFalUrl(startImageUrl),
      ensureFalUrl(endImageUrl),
    ]);
    console.log(`[generate-transition] start=${falStartUrl.slice(0, 60)}... end=${falEndUrl.slice(0, 60)}...`);

    const prompt = "Smooth cinematic camera transition between two interior spaces. Continuous fluid movement, photorealistic, locked architecture, preserve all visible surfaces exactly. No new elements, no scene morphing, natural camera flow.";

    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt,
        start_image_url: falStartUrl,
        end_image_url: falEndUrl,
        duration: String(duration) as never,
      },
      logs: true,
    }) as unknown as { data: { video: { url: string } } };

    console.log(`[generate-transition] done! videoUrl=${result.data.video.url.slice(0, 60)}...`);

    return NextResponse.json({
      videoUrl: result.data.video.url,
      duration,
    });
  } catch (err) {
    console.error("[generate-transition]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transition generation failed" },
      { status: 500 },
    );
  }
}
