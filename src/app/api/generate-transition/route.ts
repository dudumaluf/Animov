import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/kling-video/o1/image-to-video";

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
    const prompt = "Smooth cinematic camera transition between two interior spaces. Continuous fluid movement, photorealistic, locked architecture, preserve all visible surfaces exactly. No new elements, no scene morphing, natural camera flow.";

    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt,
        start_image_url: startImageUrl,
        end_image_url: endImageUrl,
        duration: String(duration) as never,
      },
      logs: true,
    }) as unknown as { data: { video: { url: string } } };

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
