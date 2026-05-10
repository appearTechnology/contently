import {
  experimental_generateVideo,
  generateImage,
  generateText,
} from "ai";
import type { ModelConfig } from "@/lib/models/registry";

const AD_INSTRUCTION =
  "You are an expert ad creative director. Using the product reference image and the creative direction below, produce one polished paid-social advertisement still. Use strong composition, readable hierarchy, and brand-appropriate lighting. Output a single compelling visual suitable for performance marketing.";

const VIDEO_AD_INSTRUCTION =
  "You are an expert ad creative director. Using the product reference image as the primary visual anchor, produce a short polished paid-social video advertisement. Match motion, pacing, composition, and lighting to the creative direction. Output compelling motion suitable for performance marketing.";

export class GenerateAdCreativeError extends Error {
  readonly code: "NO_VIDEO_MODELS";

  constructor(code: "NO_VIDEO_MODELS", message: string) {
    super(message);
    this.name = "GenerateAdCreativeError";
    this.code = code;
  }
}

export type CreativeResult =
  | { kind: "image"; base64: string; mediaType: string }
  | { kind: "video"; base64: string; mediaType: string };

function buildPromptBlock(params: {
  taskInstruction: string;
  prompt: string;
  brandContext?: string;
  includeBrandLogo: boolean;
  extraReferenceCount: number;
}): string {
  const {
    taskInstruction,
    prompt,
    brandContext,
    includeBrandLogo,
    extraReferenceCount,
  } = params;
  let block = `${taskInstruction}\n\nCreative direction:\n${prompt}`;
  const brand = brandContext?.trim();
  if (brand) {
    block += `\n\nBrand guidelines:\n${brand}`;
  }
  if (includeBrandLogo) {
    block += brand
      ? `\n\nAn additional reference image after the product photo shows the brand logo or lockup. Match geometry, placement, and clear space faithfully when using it.`
      : `\n\nBrand guidelines:\nAn additional reference image after the product photo shows the brand logo or lockup. Match geometry, placement, and clear space faithfully when using it.`;
  }
  if (extraReferenceCount > 0) {
    block += `\n\nAfter the product image${includeBrandLogo ? " and logo reference" : ""}, ${extraReferenceCount} supplementary reference image(s) follow for mood, layout, or visual cues — incorporate them only as helpful guidance alongside the main product shot.`;
  }
  return block;
}

export async function generateAdCreative(params: {
  model: ModelConfig;
  format: "photo" | "video";
  prompt: string;
  imageBuffer: Buffer;
  imageMediaType: string;
  /** Extra reference images (not product, not logo). Order: after product (+ logo in multimodal); generate-image order is product, extras, logo last. */
  referenceBuffers?: { buffer: Buffer; mediaType: string }[];
  brandContext?: string;
  brandLogoBuffer?: Buffer;
  brandLogoMediaType?: string;
}): Promise<CreativeResult> {
  const {
    model,
    format,
    prompt,
    imageBuffer,
    imageMediaType,
    referenceBuffers = [],
    brandContext,
    brandLogoBuffer,
    brandLogoMediaType,
  } = params;

  const includeBrandLogo = Boolean(
    brandLogoBuffer &&
      brandLogoBuffer.length > 0 &&
      brandLogoMediaType &&
      brandLogoMediaType.startsWith("image/"),
  );

  if (format === "video") {
    if (!model.capabilities.includes("video")) {
      throw new Error("Selected model does not support video output.");
    }

    const videoPromptBlock = buildPromptBlock({
      taskInstruction: VIDEO_AD_INSTRUCTION,
      prompt,
      brandContext,
      includeBrandLogo,
      extraReferenceCount: referenceBuffers.length,
    });

    const videoResult = await experimental_generateVideo({
      model: model.gatewayModel,
      prompt: {
        image: imageBuffer,
        text: videoPromptBlock,
      },
      providerOptions: {
        gateway: {
          tags: ["feature:ad-creative"],
        },
      },
    });

    const v = videoResult.video;
    return {
      kind: "video",
      base64: v.base64,
      mediaType: v.mediaType,
    };
  }

  const promptBlock = buildPromptBlock({
    taskInstruction: AD_INSTRUCTION,
    prompt,
    brandContext,
    includeBrandLogo,
    extraReferenceCount: referenceBuffers.length,
  });

  if (!model.capabilities.includes("image")) {
    throw new Error("Selected model does not support photo output.");
  }

  const strategy = model.imageStrategy ?? "multimodal-generate-text";

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: Buffer; mediaType: string }
  > = [
    { type: "text", text: promptBlock },
    { type: "image", image: imageBuffer, mediaType: imageMediaType },
  ];
  if (includeBrandLogo && brandLogoBuffer && brandLogoMediaType) {
    userContent.push({
      type: "image",
      image: brandLogoBuffer,
      mediaType: brandLogoMediaType,
    });
  }
  for (const ref of referenceBuffers) {
    userContent.push({
      type: "image",
      image: ref.buffer,
      mediaType: ref.mediaType,
    });
  }

  if (strategy === "multimodal-generate-text") {
    const result = await generateText({
      model: model.gatewayModel,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
      providerOptions: {
        gateway: {
          tags: ["feature:ad-creative"],
        },
      },
    });

    const imageFiles = result.files.filter((f) => f.mediaType.startsWith("image/"));
    const first = imageFiles[0];
    if (!first) {
      throw new Error(
        "The model returned no image file. Try another model or refine your creative direction.",
      );
    }
    return { kind: "image", base64: first.base64, mediaType: first.mediaType };
  }

  const refImages: Buffer[] = [imageBuffer];
  for (const ref of referenceBuffers) {
    refImages.push(ref.buffer);
  }
  if (includeBrandLogo && brandLogoBuffer) {
    refImages.push(brandLogoBuffer);
  }

  const result = await generateImage({
    model: model.gatewayModel,
    prompt: {
      images: refImages,
      text: promptBlock,
    },
    n: 1,
    providerOptions: {
      gateway: {
        tags: ["feature:ad-creative"],
      },
    },
  });

  const first = result.image;
  if (!first) {
    throw new Error(
      "The model returned no image. Try another model or refine your creative direction.",
    );
  }
  return { kind: "image", base64: first.base64, mediaType: first.mediaType };
}
