/**
 * Gateway model slugs use `provider/model` format. Validate against current
 * AI Gateway docs or `gateway.getAvailableModels()` before changing defaults:
 * https://vercel.com/docs/ai-gateway
 * https://vercel.com/ai-gateway/models?type=image
 */

export type Capability = "image" | "video";

/** How a photo ad is produced for models that support `image` capability. */
export type ImageStrategy = "multimodal-generate-text" | "generate-image-prompt";

export interface ModelConfig {
  id: string;
  gatewayModel: string;
  label: string;
  description?: string;
  capabilities: Capability[];
  imageStrategy?: ImageStrategy;
}

export const MODELS: ModelConfig[] = [
  {
    id: "gemini-3.1-flash-image",
    gatewayModel: "google/gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    description: "Fast multimodal image ads from your product photo and prompt.",
    capabilities: ["image"],
    imageStrategy: "multimodal-generate-text",
  },
  {
    id: "imagen-4",
    gatewayModel: "google/imagen-4.0-generate-001",
    label: "Imagen 4",
    description: "Reference-based generation via prompt images + text.",
    capabilities: ["image"],
    imageStrategy: "generate-image-prompt",
  },
  {
    id: "gpt-image-2",
    gatewayModel: "openai/gpt-image-2",
    label: "GPT Image 2",
    description: "OpenAI image model. Reference-based generation via prompt images + text.",
    capabilities: ["image"],
    imageStrategy: "generate-image-prompt",
  },
  {
    id: "seedance-2",
    gatewayModel: "bytedance/seedance-2.0",
    label: "Seedance 2.0",
    description:
      "ByteDance image-to-video for short paid-social spots. Uses your product photo as the visual anchor.",
    capabilities: ["video"],
  },
];

export function getModelsForCapability(cap: Capability): ModelConfig[] {
  return MODELS.filter((m) => m.capabilities.includes(cap));
}

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id);
}

export function defaultModelIdForCapability(cap: Capability): string | undefined {
  return getModelsForCapability(cap)[0]?.id;
}

export function modelSupportsFormat(
  model: ModelConfig,
  format: "photo" | "video",
): boolean {
  if (format === "photo") return model.capabilities.includes("image");
  return model.capabilities.includes("video");
}
