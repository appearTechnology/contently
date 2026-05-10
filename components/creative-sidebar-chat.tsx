"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ImagePlusIcon,
  Loader2Icon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_BRANDING_KIT_META,
  type BrandingKitMeta,
} from "@/lib/branding/types";
import {
  buildGenerateCreativeFormData,
  GENERATE_ACCEPT,
  MAX_REFERENCE_IMAGES,
} from "@/lib/generate/form-data";
import {
  defaultModelIdForCapability,
  getModelsForCapability,
  type ModelConfig,
} from "@/lib/models/registry";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENTS = 1 + MAX_REFERENCE_IMAGES;

type OutputFormat = "photo" | "video";

type Attachment = {
  id: string;
  file: File;
  previewUrl: string;
};

type ChatMessage =
  | {
      id: string;
      role: "user";
      text: string;
      imageUrls: string[];
    }
  | {
      id: string;
      role: "assistant";
      status: "loading";
    }
  | {
      id: string;
      role: "assistant";
      status: "error";
      error: string;
    }
  | {
      id: string;
      role: "assistant";
      status: "done";
      resultDataUrl: string;
    };

export function CreativeSidebarChat({
  brandingMeta = EMPTY_BRANDING_KIT_META,
}: {
  brandingMeta?: BrandingKitMeta;
}) {
  const fileInputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [draft, setDraft] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("photo");
  const [modelId, setModelId] = useState(
    () => defaultModelIdForCapability("image") ?? "",
  );
  const [applyBranding, setApplyBranding] = useState(true);
  const [sending, setSending] = useState(false);

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

  const revokeAttachment = useCallback((a: Attachment) => {
    URL.revokeObjectURL(a.previewUrl);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found) revokeAttachment(found);
      return prev.filter((x) => x.id !== id);
    });
  }, [revokeAttachment]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const accepted = GENERATE_ACCEPT.split(",");
      setAttachments((prev) => {
        const next = [...prev];
        for (const f of Array.from(list)) {
          if (next.length >= MAX_ATTACHMENTS) {
            toast.error(`At most ${MAX_ATTACHMENTS} images (1 product + ${MAX_REFERENCE_IMAGES} references).`);
            break;
          }
          if (!accepted.includes(f.type)) {
            toast.error("Use JPEG, PNG, or WebP.");
            continue;
          }
          next.push({
            id: crypto.randomUUID(),
            file: f,
            previewUrl: URL.createObjectURL(f),
          });
        }
        return next;
      });
    },
    [],
  );

  const attachmentsRef = useRef<Attachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(revokeAttachment);
    };
  }, [revokeAttachment]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const clearThread = useCallback(() => {
    const urls = attachments.map((a) => a.previewUrl);
    setMessages([]);
    setAttachments([]);
    setDraft("");
    urls.forEach((u) => URL.revokeObjectURL(u));
  }, [attachments]);

  const send = async () => {
    const primary = attachments[0]?.file;
    if (!primary) {
      toast.error("Add at least one product image.");
      return;
    }
    if (!draft.trim()) {
      toast.error("Enter a prompt.");
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

    const promptText = draft.trim();
    const refs = attachments.slice(1).map((a) => a.file);
    const snapshotUrls = attachments.map((a) => a.previewUrl);
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        text: promptText,
        imageUrls: snapshotUrls,
      },
      { id: assistantMsgId, role: "assistant", status: "loading" },
    ]);
    setDraft("");
    setSending(true);

    try {
      const form = buildGenerateCreativeFormData({
        primaryImage: primary,
        referenceImages: refs,
        prompt: promptText,
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
        kind?: string;
        base64?: string;
        mediaType?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (data.kind === "image" && data.base64 && data.mediaType) {
        const resultDataUrl = `data:${data.mediaType};base64,${data.base64}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId && m.role === "assistant"
              ? { id: assistantMsgId, role: "assistant", status: "done", resultDataUrl }
              : m,
          ),
        );
        toast.success("Creative ready.");
      } else {
        throw new Error("Unexpected response from server.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId && m.role === "assistant"
            ? {
                id: assistantMsgId,
                role: "assistant",
                status: "error",
                error: message,
              }
            : m,
        ),
      );
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-2 py-2">
        <span className="text-sidebar-foreground/80 truncate text-xs font-medium">
          Creative chat
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-sidebar-foreground hover:bg-sidebar-accent h-8 shrink-0 px-2 text-xs"
          disabled={messages.length === 0 && attachments.length === 0 && !draft}
          onClick={clearThread}
        >
          <Trash2Icon className="size-3.5" aria-hidden />
          Clear
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-3"
      >
        {messages.length === 0 ? (
          <p className="text-sidebar-foreground/70 px-1 text-xs leading-relaxed">
            Add images and a prompt, then send. Each message runs a full generation
            through AI Gateway (same as the Generate page).
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col gap-1.5",
              m.role === "user" ? "items-end" : "items-start",
            )}
          >
            {m.role === "user" ? (
              <>
                {m.imageUrls.length > 0 ? (
                  <div className="flex max-w-[95%] flex-wrap justify-end gap-1">
                    {m.imageUrls.map((url) => (
                      <div
                        key={url}
                        className="relative size-14 shrink-0 overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent/30"
                      >
                        <Image
                          src={url}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="bg-sidebar-accent text-sidebar-accent-foreground max-w-[95%] rounded-lg px-2.5 py-2 text-xs leading-relaxed break-words">
                  {m.text}
                </div>
              </>
            ) : null}
            {m.role === "assistant" && m.status === "loading" ? (
              <div className="border-sidebar-border bg-sidebar-accent/20 flex max-w-[95%] items-center gap-2 rounded-lg border px-3 py-3">
                <Loader2Icon className="text-sidebar-foreground size-4 animate-spin" />
                <span className="text-sidebar-foreground/80 text-xs">
                  Generating…
                </span>
              </div>
            ) : null}
            {m.role === "assistant" && m.status === "error" ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive max-w-[95%] rounded-lg border px-2.5 py-2 text-xs leading-relaxed">
                {m.error}
              </div>
            ) : null}
            {m.role === "assistant" && m.status === "done" ? (
              <div className="relative max-h-48 w-full max-w-[95%] overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-accent/20">
                <div className="relative aspect-square w-full">
                  <Image
                    src={m.resultDataUrl}
                    alt="Generated creative"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-sidebar-border shrink-0 space-y-2 border-t px-2 py-2">
        <Tabs value={outputFormat} onValueChange={onOutputFormatChange}>
          <TabsList className="grid h-8 w-full grid-cols-2">
            <TabsTrigger value="photo" className="text-xs">
              Photo
            </TabsTrigger>
            <TabsTrigger
              value="video"
              className="text-xs"
              disabled={!hasVideoModels}
            >
              Video
            </TabsTrigger>
          </TabsList>
          <TabsContent value="photo" className="mt-2 space-y-1.5">
            <Label htmlFor="sidebar-model-photo" className="text-sidebar-foreground/80 text-[11px]">
              Model
            </Label>
            <Select value={modelId} onValueChange={(v) => setModelId(v ?? "")}>
              <SelectTrigger
                id="sidebar-model-photo"
                size="sm"
                className="bg-sidebar-accent/30 border-sidebar-border h-8 w-full text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ModelHint models={models} selectedId={modelId} />
          </TabsContent>
          <TabsContent value="video" className="mt-2 space-y-1.5">
            {!hasVideoModels ? (
              <p className="text-sidebar-foreground/70 text-[11px] leading-relaxed">
                Add video-capable models in{" "}
                <code className="rounded bg-sidebar-accent/50 px-0.5">registry.ts</code>
                .
              </p>
            ) : (
              <>
                <Label htmlFor="sidebar-model-video" className="text-sidebar-foreground/80 text-[11px]">
                  Model
                </Label>
                <Select value={modelId} onValueChange={(v) => setModelId(v ?? "")}>
                  <SelectTrigger
                    id="sidebar-model-video"
                    size="sm"
                    className="bg-sidebar-accent/30 border-sidebar-border h-8 w-full text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ModelHint models={models} selectedId={modelId} />
              </>
            )}
          </TabsContent>
        </Tabs>

        {hasBrandKit ? (
          <div className="flex items-start gap-2 pt-1">
            <input
              id="sidebar-apply-branding"
              type="checkbox"
              checked={applyBranding}
              onChange={(e) => setApplyBranding(e.target.checked)}
              className="border-sidebar-border text-sidebar-primary focus-visible:ring-sidebar-ring mt-0.5 size-3.5 shrink-0 rounded border shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <Label
              htmlFor="sidebar-apply-branding"
              className="text-sidebar-foreground/80 cursor-pointer text-[11px] leading-snug font-normal"
            >
              Apply saved branding
            </Label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <div
              key={a.id}
              className="border-sidebar-border group relative size-12 overflow-hidden rounded-md border"
            >
              <Image
                src={a.previewUrl}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
              {i === 0 ? (
                <span className="bg-sidebar-primary text-sidebar-primary-foreground absolute left-0.5 top-0.5 rounded px-1 text-[9px] font-medium leading-none">
                  Main
                </span>
              ) : null}
              <button
                type="button"
                className="bg-background/80 absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background"
                onClick={() => removeAttachment(a.id)}
                aria-label="Remove image"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
          {attachments.length < MAX_ATTACHMENTS ? (
            <label
              htmlFor={fileInputId}
              className="border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent/40 flex size-12 cursor-pointer items-center justify-center rounded-md border border-dashed"
            >
              <ImagePlusIcon className="size-4" aria-hidden />
              <input
                id={fileInputId}
                type="file"
                accept={GENERATE_ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  const fl = e.target.files;
                  if (fl?.length) addFiles(fl);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
        <p className="text-sidebar-foreground/60 text-[10px] leading-relaxed">
          First image = product shot; up to {MAX_REFERENCE_IMAGES} extra references.
        </p>

        <div className="flex gap-1.5">
          <Textarea
            placeholder="Creative direction…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            disabled={sending}
            className="border-sidebar-border bg-sidebar-accent/20 min-h-[72px] resize-none text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending) void send();
              }
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 w-full gap-1.5 text-xs"
          disabled={
            sending ||
            !attachments[0] ||
            !draft.trim() ||
            !modelId ||
            (outputFormat === "video" && !hasVideoModels)
          }
          onClick={() => void send()}
        >
          {sending ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <SendIcon className="size-3.5" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ModelHint({
  models,
  selectedId,
}: {
  models: ModelConfig[];
  selectedId: string;
}) {
  const m = models.find((x) => x.id === selectedId);
  if (!m?.description) return null;
  return (
    <p className="text-sidebar-foreground/60 line-clamp-3 text-[10px] leading-relaxed">
      {m.description}
    </p>
  );
}
