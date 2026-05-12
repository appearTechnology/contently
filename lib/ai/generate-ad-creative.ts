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
  /** Number of official brand reference images after the product (primary lockup, optional secondary lockup, optional icon). */
  brandReferenceImageCount: number;
  /** Mood/layout reference images supplied by the user (after brand marks in multimodal order). */
  userReferenceCount: number;
}): string {
  const {
    taskInstruction,
    prompt,
    brandContext,
    brandReferenceImageCount,
    userReferenceCount,
  } = params;
  let block = `${taskInstruction}\n\nCreative direction:\n${prompt}`;
  const brand = brandContext?.trim();
  if (brand) {
    block += `\n\nBrand guidelines:\n${brand}`;
  }
  if (brandReferenceImageCount > 0) {
    const intro = brand
      ? `\n\nAfter the product image, ${brandReferenceImageCount} official brand reference image(s) follow in order`
      : `\n\nBrand guidelines:\nAfter the product image, ${brandReferenceImageCount} official brand reference image(s) follow in order`;
    block += `${intro} (primary lockup when present, then optional secondary lockup and/or square icon mark). Match geometry, placement, clear space, and typography faithfully when using them.`;
  }
  if (userReferenceCount > 0) {
    if (brandReferenceImageCount > 0) {
      block += `\n\nAfter those brand images, ${userReferenceCount} supplementary reference image(s) follow for mood, layout, or visual cues — incorporate them only as helpful guidance alongside the main product shot.`;
    } else {
      block += `\n\nAfter the product image, ${userReferenceCount} supplementary reference image(s) follow for mood, layout, or visual cues — incorporate them only as helpful guidance alongside the main product shot.`;
    }
  }
  return block;
}

function isRasterBrandImage(
  buffer: Buffer | undefined,
  mediaType: string | undefined,
): boolean {
  return Boolean(
    buffer &&
      buffer.length > 0 &&
      mediaType &&
      mediaType.startsWith("image/"),
  );
}

export async function generateAdCreative(params: {
  model: ModelConfig;
  format: "photo" | "video";
  prompt: string;
  imageBuffer: Buffer;
  imageMediaType: string;
  /** Mood/layout references from the user (after brand marks in multimodal order). */
  referenceBuffers?: { buffer: Buffer; mediaType: string }[];
  brandContext?: string;
  /** Primary lockup (first brand image after the product when present). */
  brandLogoBuffer?: Buffer;
  brandLogoMediaType?: string;
  /** Alternate horizontal / secondary lockup. */
  brandSecondaryLogoBuffer?: Buffer;
  brandSecondaryLogoMediaType?: string;
  /** Square or icon mark. */
  brandIconBuffer?: Buffer;
  brandIconMediaType?: string;
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
    brandSecondaryLogoBuffer,
    brandSecondaryLogoMediaType,
    brandIconBuffer,
    brandIconMediaType,
  } = params;

  const hasPrimaryBrand = isRasterBrandImage(brandLogoBuffer, brandLogoMediaType);
  const hasSecondaryBrand = isRasterBrandImage(
    brandSecondaryLogoBuffer,
    brandSecondaryLogoMediaType,
  );
  const hasIconBrand = isRasterBrandImage(brandIconBuffer, brandIconMediaType);
  const brandReferenceImageCount =
    (hasPrimaryBrand ? 1 : 0) + (hasSecondaryBrand ? 1 : 0) + (hasIconBrand ? 1 : 0);

  if (format === "video") {
    if (!model.capabilities.includes("video")) {
      throw new Error("Selected model does not support video output.");
    }

    const videoPromptBlock = buildPromptBlock({
      taskInstruction: VIDEO_AD_INSTRUCTION,
      prompt,
      brandContext,
      brandReferenceImageCount: hasPrimaryBrand ? 1 : 0,
      userReferenceCount: referenceBuffers.length,
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
    brandReferenceImageCount,
    userReferenceCount: referenceBuffers.length,
  });

  if (!model.capabilities.includes("image")) {
    throw new Error("Selected model does not support photo output.");
  }

  const strategy = model.imageStrategy ?? "multimodal-generate-text";

  const brandImages: { buffer: Buffer; mediaType: string }[] = [];
  if (hasPrimaryBrand && brandLogoBuffer && brandLogoMediaType) {
    brandImages.push({ buffer: brandLogoBuffer, mediaType: brandLogoMediaType });
  }
  if (hasSecondaryBrand && brandSecondaryLogoBuffer && brandSecondaryLogoMediaType) {
    brandImages.push({
      buffer: brandSecondaryLogoBuffer,
      mediaType: brandSecondaryLogoMediaType,
    });
  }
  if (hasIconBrand && brandIconBuffer && brandIconMediaType) {
    brandImages.push({ buffer: brandIconBuffer, mediaType: brandIconMediaType });
  }

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: Buffer; mediaType: string }
  > = [
    { type: "text", text: promptBlock },
    { type: "image", image: imageBuffer, mediaType: imageMediaType },
  ];
  for (const b of brandImages) {
    userContent.push({
      type: "image",
      image: b.buffer,
      mediaType: b.mediaType,
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
  for (const b of brandImages) {
    refImages.push(b.buffer);
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
