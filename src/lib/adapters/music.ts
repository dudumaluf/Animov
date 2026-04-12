import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/minimax-music/v2.6";

type MusicOutput = {
  audio: {
    url: string;
  };
};

export async function generateMusic({
  prompt,
  instrumental = true,
}: {
  prompt: string;
  instrumental?: boolean;
}): Promise<{ audioUrl: string }> {
  const result = await fal.subscribe(MODEL_ID, {
    input: {
      prompt,
      is_instrumental: instrumental,
    },
    logs: true,
  }) as unknown as { data: MusicOutput };

  return { audioUrl: result.data.audio.url };
}
