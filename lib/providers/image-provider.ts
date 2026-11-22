import Together from "together-ai";

export type ImageRequest = {
  prompt: string;
  referenceImages: string[];
  width: number;
  height: number;
};

export type ImageProvider = {
  generate(request: ImageRequest): Promise<string>;
};

const IMAGE_MODEL = "google/flash-image-2.5";
const FIXED_DIMENSIONS = { width: 864, height: 1184 };

/** Together keeps `reference_images`, which is what holds character identity. */
export function createTogetherProvider(apiKey: string): ImageProvider {
  const client = new Together({ apiKey });

  return {
    async generate({ prompt, referenceImages, width, height }) {
      const response = await client.images.generate({
        model: IMAGE_MODEL,
        prompt,
        width: width || FIXED_DIMENSIONS.width,
        height: height || FIXED_DIMENSIONS.height,
        temperature: 0.1,
        reference_images:
          referenceImages.length > 0 ? referenceImages : undefined,
      });

      const url = response.data?.[0]?.url;
      if (!url) throw new Error("Le fournisseur n'a renvoyé aucune image.");
      return url;
    },
  };
}
