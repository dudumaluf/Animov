import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { editImage } from "@/lib/adapters/nano-banana";

fal.config({ credentials: process.env.FAL_KEY! });

async function ensureFalUrl(url: string): Promise<string> {
  if (url.startsWith("https://") && !url.startsWith("data:") && !url.startsWith("blob:")) {
    return url;
  }
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
  return fal.storage.upload(file);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    prompt,
    sourceImageUrl,
    referenceImageUrls = [],
    aspectRatio = "auto",
    resolution = "1K",
    presetId,
  } = body as {
    prompt: string;
    sourceImageUrl: string;
    referenceImageUrls?: string[];
    aspectRatio?: string;
    resolution?: string;
    presetId?: string;
  };

  if (!prompt || !sourceImageUrl) {
    return NextResponse.json({ error: "prompt and sourceImageUrl required" }, { status: 400 });
  }

  const admin = createAdminClient();

  let debited = false;
  try {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_credit", {
      p_user_id: user.id,
      p_amount: 1,
      p_reason: `Edit imagem: ${presetId ?? "custom"}`,
    });

    if (debitError) {
      if (debitError.message.includes("Insufficient")) {
        return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });
      }
      return NextResponse.json({ error: debitError.message }, { status: 500 });
    }

    debited = true;

    const falSourceUrl = await ensureFalUrl(sourceImageUrl);
    const falRefUrls = await Promise.all(referenceImageUrls.map(ensureFalUrl));
    const allImageUrls = [falSourceUrl, ...falRefUrls];

    const result = await editImage({
      prompt,
      imageUrls: allImageUrls,
      aspectRatio,
      resolution,
    });

    await admin.from("generation_logs").insert({
      user_id: user.id,
      generation_type: "image_edit",
      preset_id: presetId ?? null,
      final_positive_prompt: prompt,
      cost: resolution === "4K" ? 0.16 : resolution === "2K" ? 0.12 : 0.08,
      request_payload: { sourceImageUrl: falSourceUrl, referenceCount: falRefUrls.length, aspectRatio, resolution },
      response_payload: { imageUrl: result.imageUrl },
    });

    return NextResponse.json({
      imageUrl: result.imageUrl,
      description: result.description,
      creditsRemaining: newBalance,
    });
  } catch (err) {
    if (debited) {
      await admin.rpc("add_credit", {
        p_user_id: user.id,
        p_amount: 1,
        p_reason: "Reembolso: erro na edição de imagem",
        p_admin_id: null,
      });
    }

    console.error("[edit-image]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image edit failed" },
      { status: 500 },
    );
  }
}
