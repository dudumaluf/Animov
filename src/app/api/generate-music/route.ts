import { NextRequest, NextResponse } from "next/server";
import { generateMusic } from "@/lib/adapters/music";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = body.prompt as string;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const result = await generateMusic({
      prompt,
      instrumental: body.instrumental ?? true,
    });

    return NextResponse.json({ audioUrl: result.audioUrl });
  } catch (err) {
    console.error("[generate-music]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Music generation failed" },
      { status: 500 },
    );
  }
}
