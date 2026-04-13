import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY! });

const MODEL_ID = "fal-ai/nano-banana-2/edit";

type NanoBananaInput = {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: string;
  resolution?: string;
  numImages?: number;
};

type NanoBananaOutput = {
  images: Array<{
    url: string;
    file_name: string;
    content_type: string;
  }>;
  description: string;
};

export async function editImage({
  prompt,
  imageUrls,
  aspectRatio = "auto",
  resolution = "1K",
  numImages = 1,
}: NanoBananaInput): Promise<{ imageUrl: string; description: string }> {
  const result = await fal.subscribe(MODEL_ID, {
    input: {
      prompt,
      image_urls: imageUrls,
      aspect_ratio: aspectRatio,
      resolution: resolution as never,
      num_images: numImages,
      output_format: "png",
      limit_generations: true,
    },
    logs: true,
  }) as unknown as { data: NanoBananaOutput };

  const firstImage = result.data.images[0];
  if (!firstImage) throw new Error("No image returned");

  return {
    imageUrl: firstImage.url,
    description: result.data.description,
  };
}
