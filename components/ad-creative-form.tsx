"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  Palette,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultModelIdForCapability,
  getModelsForCapability,
} from "@/lib/models/registry";
import {
  EMPTY_BRANDING_KIT_META,
  type BrandingKitMeta,
} from "@/lib/branding/types";
import {
  buildGenerateCreativeFormData,
  GENERATE_ACCEPT,
} from "@/lib/generate/form-data";
import { cn } from "@/lib/utils";

type OutputFormat = "photo" | "video";

const DEFAULT_RESULT_FILENAME = "ad-creative.png";

export function AdCreativeForm({
  brandingMeta = EMPTY_BRANDING_KIT_META,
}: {
  brandingMeta?: BrandingKitMeta;
}) {
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("photo");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modelId, setModelId] = useState(() =>
    defaultModelIdForCapability("image") ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [resultKind, setResultKind] = useState<"image" | "video" | null>(null);
  const [resultDownloadName, setResultDownloadName] =
    useState<string>(DEFAULT_RESULT_FILENAME);
  const [applyBranding, setApplyBranding] = useState(true);

  const hasBrandKit = brandingMeta.hasContent;

  const capability = outputFormat === "photo" ? "image" : "video";
  const models = useMemo(() => getModelsForCapability(capability), [capability]);
  const hasVideoModels = getModelsForCapability("video").length > 0;

  const onOutputFormatChange = useCallback((value: string) => {
    const next = value as OutputFormat;
    setOutputFormat(next);
    const cap = next === "photo" ? "image" : "video";
    const list = getModelsForCapability(cap);
    const fallback = defaultModelIdForCapability(cap) ?? "";
    setModelId((id) => (list.some((m) => m.id === id) ? id : fallback));
  }, []);

  const onFileChosen = useCallback((next: File | null) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next ? URL.createObjectURL(next) : null;
    });
    setFile(next);
    setResultDataUrl(null);
    setResultKind(null);
    setResultDownloadName(DEFAULT_RESULT_FILENAME);
  }, []);

  const downloadGeneratedMedia = useCallback(async () => {
    if (!resultDataUrl) return;
    try {
      const res = await fetch(resultDataUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resultDownloadName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(
        resultKind === "video"
          ? "Could not download the video."
          : "Could not download the image.",
      );
    }
  }, [resultDataUrl, resultDownloadName, resultKind]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileChosen(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type && GENERATE_ACCEPT.split(",").includes(f.type)) {
      onFileChosen(f);
    } else if (f) {
      toast.error("Use a JPEG, PNG, or WebP image.");
    }
  };

  const generate = async () => {
    if (!file) {
      toast.error("Add a product photo.");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Describe the ad you want.");
      return;
    }
    if (outputFormat === "video" && !hasVideoModels) {
      toast.error("No video models are configured yet.");
      return;
    }
    if (!modelId) {
      toast.error("Pick a model.");
      return;
    }

    setLoading(true);
    setResultDataUrl(null);
    setResultKind(null);
    try {
      const form = buildGenerateCreativeFormData({
        primaryImage: file,
        prompt: prompt.trim(),
        format: outputFormat,
        modelId,
        applyBranding,
      });

      const res = await fetch("/api/generate", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        kind?: string;
        base64?: string;
        mediaType?: string;
        downloadName?: string;
      };

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "Request failed",
        );
      }

      const nameOk =
        typeof data.downloadName === "string" && data.downloadName.length > 0;

      if (data.kind === "image" && data.base64 && data.mediaType) {
        setResultDataUrl(`data:${data.mediaType};base64,${data.base64}`);
        setResultKind("image");
        setResultDownloadName(nameOk ? data.downloadName! : DEFAULT_RESULT_FILENAME);
        toast.success("Creative ready.");
      } else if (data.kind === "video" && data.base64 && data.mediaType) {
        setResultDataUrl(`data:${data.mediaType};base64,${data.base64}`);
        setResultKind("video");
        setResultDownloadName(nameOk ? data.downloadName! : "ad-creative.mp4");
        toast.success("Video ready.");
      } else {
        throw new Error("Unexpected response from server.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="size-5" aria-hidden />
            Product reference
          </CardTitle>
          <CardDescription>
            One clear packshot or lifestyle shot works best. Many image models
            reject photos that may show a recognizable real person.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            htmlFor="product-image"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={cn(
              "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-input bg-muted/30 px-4 py-8 text-center transition-colors hover:bg-muted/50",
              previewUrl && "min-h-0",
            )}
          >
            {previewUrl ? (
              <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-lg border bg-background shadow-sm">
                <Image
                  src={previewUrl}
                  alt="Product preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <>
                <UploadIcon className="text-muted-foreground size-10" />
                <div>
                  <span className="text-sm font-medium">Drop an image here</span>
                  <p className="text-muted-foreground mt-1 text-xs">
                    JPEG, PNG, or WebP · up to 8 MB
                  </p>
                </div>
              </>
            )}
            <input
              id="product-image"
              type="file"
              accept={GENERATE_ACCEPT}
              className="sr-only"
              onChange={onInputChange}
            />
          </label>
          {previewUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                onFileChosen(null);
              }}
            >
              Remove image
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Creative direction</CardTitle>
          <CardDescription>
            Audience, offer, tone, platform (e.g. Meta feed), and any must-show
            claims or disclaimers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="ad-prompt"
            placeholder="e.g. Bold summer sale hero for Instagram; 40% off headline; energetic, Gen-Z friendly…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="resize-y min-h-[120px]"
            aria-label="Creative direction"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="size-5" aria-hidden />
            Branding
          </CardTitle>
          <CardDescription>
            Saved on this device under Branding — applied as extra prompt context and,
            if you added one, a logo reference image alongside your product shot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasBrandKit ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                Add colors, type, voice, and an optional logo so generations stay
                consistent.
              </p>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/branding" />}
              >
                Configure branding
              </Button>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{brandingPreview(brandingMeta)}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <Checkbox
                    id="apply-branding"
                    checked={applyBranding}
                    onCheckedChange={(checked) => setApplyBranding(checked === true)}
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="apply-branding" className="cursor-pointer font-normal">
                      Apply saved branding to this generation
                    </Label>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Uncheck to use only the creative direction above.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 self-start"
                  nativeButton={false}
                  render={<Link href="/branding" />}
                >
                  Edit branding
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Output & model</CardTitle>
          <CardDescription>
            Models are gateway slugs — add or change entries in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              lib/models/registry.ts
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={outputFormat} onValueChange={onOutputFormatChange}>
            <TabsList>
              <TabsTrigger value="photo">Photo ad</TabsTrigger>
              <TabsTrigger value="video">Video ad</TabsTrigger>
            </TabsList>
            <TabsContent value="photo" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model-photo">Model</Label>
                <Select
                  value={modelId}
                  onValueChange={(v) => setModelId(v ?? "")}
                >
                  <SelectTrigger id="model-photo" className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ModelHint models={models} selectedId={modelId} />
              </div>
            </TabsContent>
            <TabsContent value="video" className="mt-4 space-y-4">
              {!hasVideoModels ? (
                <Alert>
                  <AlertTitle>No video models yet</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      Register models with the <code>video</code> capability in{" "}
                      <code>lib/models/registry.ts</code>, then wire them in{" "}
                      <code>lib/ai/generate-ad-creative.ts</code>. See{" "}
                      <a
                        href="https://vercel.com/docs/ai-gateway"
                        className="font-medium underline underline-offset-4"
                        target="_blank"
                        rel="noreferrer"
                      >
                        AI Gateway docs
                      </a>{" "}
                      for supported providers.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="model-video">Model</Label>
                  <Select
                    value={modelId}
                    onValueChange={(v) => setModelId(v ?? "")}
                  >
                    <SelectTrigger id="model-video" className="w-full max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ModelHint models={models} selectedId={modelId} />
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Button
            type="button"
            size="lg"
            className="w-full gap-2 sm:w-auto"
            disabled={
              loading ||
              !file ||
              !prompt.trim() ||
              !modelId ||
              (outputFormat === "video" && !hasVideoModels)
            }
            onClick={() => void generate()}
          >
            {loading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <SparklesIcon className="size-4" />
                Generate creative
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Result</CardTitle>
          <CardDescription>
            {resultKind === "video"
              ? "Latest generated video."
              : resultKind === "image"
                ? "Latest generated still."
                : outputFormat === "video"
                  ? "Generated video appears here after you run the generator."
                  : "Generated artwork appears here after you run the generator."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton
              className={cn(
                "w-full max-w-md rounded-xl",
                outputFormat === "video" ? "aspect-video" : "aspect-square",
              )}
            />
          ) : resultDataUrl && resultKind === "video" ? (
            <div className="flex max-w-md flex-col gap-3">
              <div className="overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
                <video
                  src={resultDataUrl}
                  controls
                  playsInline
                  className="aspect-video max-h-[min(480px,70vh)] w-full bg-black object-contain"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                onClick={() => void downloadGeneratedMedia()}
              >
                <DownloadIcon className="size-4" aria-hidden />
                Download video
              </Button>
            </div>
          ) : resultDataUrl ? (
            <div className="flex max-w-md flex-col gap-3">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
                <Image
                  src={resultDataUrl}
                  alt="Generated ad creative"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                onClick={() => void downloadGeneratedMedia()}
              >
                <DownloadIcon className="size-4" aria-hidden />
                Download image
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {outputFormat === "video"
                ? "Generated video appears here after you run the generator."
                : "Generated artwork appears here after you run the generator."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModelHint({
  models,
  selectedId,
}: {
  models: { id: string; description?: string }[];
  selectedId: string;
}) {
  const m = models.find((x) => x.id === selectedId);
  if (!m?.description) return null;
  return (
    <p className="text-muted-foreground text-xs leading-relaxed">{m.description}</p>
  );
}

function brandingPreview(meta: BrandingKitMeta): string {
  const parts: string[] = [];
  if (meta.brandName) parts.push(meta.brandName);
  if (meta.hasPalette) parts.push("palette");
  if (meta.hasTypography) parts.push("typography");
  if (meta.hasVoiceTone) parts.push("voice");
  if (meta.hasExtraNotes) parts.push("notes");
  if (meta.hasLogo) parts.push("logo");
  return parts.length > 0
    ? `Using: ${parts.join(" · ")}`
    : "Logo reference will be sent with your product image.";
}
