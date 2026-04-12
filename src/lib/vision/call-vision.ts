import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "openrouter/router/vision";

const TIER_MODELS: Record<string, string> = {
  fast: "google/gemini-2.5-flash",
  smart: "anthropic/claude-sonnet-4.5",
};

type VisionOutput = {
  output: string;
  usage: {
    cost: number;
    prompt_tokens: number;
    total_tokens: number;
    completion_tokens: number;
  };
};

export async function callVision({
  imageUrl,
  systemPrompt,
  tier = "fast",
}: {
  imageUrl: string;
  systemPrompt: string;
  tier?: "fast" | "smart";
}): Promise<{ data: Record<string, unknown>; rawOutput: string; cost: number }> {
  const model = TIER_MODELS[tier] ?? TIER_MODELS.fast!;

  const result = await fal.subscribe(MODEL_ID, {
    input: {
      image_urls: [imageUrl],
      prompt: "Respond ONLY in valid JSON matching the schema described in your instructions. No markdown, no explanation, just the JSON object.",
      system_prompt: systemPrompt,
      model,
      temperature: 0.2,
      max_tokens: 500,
    },
    logs: true,
  }) as unknown as { data: VisionOutput };

  const rawOutput = result.data.output;

  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Vision LLM did not return valid JSON: ${rawOutput.slice(0, 200)}`);
  }

  const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  return {
    data,
    rawOutput,
    cost: result.data.usage?.cost ?? 0,
  };
}
