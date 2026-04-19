import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callVision } from "@/lib/vision/call-vision";
import { ensureFalUrl } from "@/lib/fal-helpers";
import { PLACEMENT_DESCRIPTOR_PROMPT } from "@/lib/prompts/placement-system-prompt";

type ReferencePayload = {
  index: number;
  name: string;
  positioned: boolean;
};

type AnalyzeBody = {
  annotatedTargetUrl: string;
  references: ReferencePayload[];
};

type MarkerDescription = {
  index: number;
  description: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { annotatedTargetUrl, references } = body;

  if (!annotatedTargetUrl) {
    return NextResponse.json(
      { error: "annotatedTargetUrl is required" },
      { status: 400 },
    );
  }

  if (!Array.isArray(references) || references.length === 0) {
    return NextResponse.json(
      { error: "at least one reference is required" },
      { status: 400 },
    );
  }

  const positioned = references
    .filter((r) => r.positioned)
    .sort((a, b) => a.index - b.index);

  if (positioned.length === 0) {
    return NextResponse.json(
      { error: "at least one reference must be positioned" },
      { status: 400 },
    );
  }

  try {
    const falAnnotatedUrl = await ensureFalUrl(annotatedTargetUrl);
    if (!falAnnotatedUrl) {
      throw new Error("Failed to prepare annotated target image");
    }

    const markerList = positioned
      .map((r) => `- marker ${r.index}: "${r.name}"`)
      .join("\n");

    const userPrompt = [
      `Describe what is at each numbered magenta marker in the scene.`,
      `Markers present (with the short label that was painted on the image):`,
      markerList,
      `Return STRICT JSON only: { "markers": [{ "index": number, "description": string }] }.`,
      `Write descriptions in Portuguese.`,
    ].join("\n\n");

    const visionResult = await callVision({
      imageUrls: [falAnnotatedUrl],
      systemPrompt: PLACEMENT_DESCRIPTOR_PROMPT,
      userPrompt,
      tier: "fast",
      maxTokens: 600,
    });

    const data = visionResult.data as { markers?: unknown };
    const rawMarkers = Array.isArray(data.markers) ? data.markers : [];

    const markers: MarkerDescription[] = rawMarkers
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const m = raw as { index?: unknown; description?: unknown };
        const index = typeof m.index === "number" ? m.index : Number(m.index);
        const description =
          typeof m.description === "string" ? m.description.trim() : "";
        if (!Number.isFinite(index) || description.length === 0) return null;
        return { index, description };
      })
      .filter((m): m is MarkerDescription => m !== null);

    if (markers.length === 0) {
      return NextResponse.json(
        {
          error: "Vision model returned no marker descriptions",
          rawOutput: visionResult.rawOutput.slice(0, 400),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      markers,
      cost: visionResult.cost,
    });
  } catch (err) {
    console.error("[edit-image/analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vision analyze failed" },
      { status: 500 },
    );
  }
}
