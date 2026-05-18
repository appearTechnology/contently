# Image Strategy Discussion

Context: `app/api/generate/route.ts`, `lib/models/registry.ts`, `lib/ai/generate-ad-creative.ts`

---

## Q: What exactly is the difference between the image strategies? Which one has a chance of generating a better image?

The difference is not just a label in the registry — it changes which API call is made in `lib/ai/generate-ad-creative.ts`.

### `multimodal-generate-text` (Gemini 3.1 Flash Image)

Path: `generate-ad-creative.ts:205-229`, calls **`generateText()`**.

The model is treated as a **multimodal chat LLM**. The prompt + product image + brand logos + reference images are all packed into a single `user` message as mixed `text`/`image` content. The model reasons over everything conversationally and emits the result as an image file attachment, pulled out of `result.files`.

### `generate-image-prompt` (GPT Image 2, Seedream 4, Grok Imagine, Imagen 4)

Path: `generate-ad-creative.ts:231-259`, calls **`generateImage()`**.

This hits a dedicated **text-to-image endpoint**. Images go in as a flat `images: []` conditioning array plus a `text` prompt — no conversational reasoning step. The endpoint returns a single image directly (`result.image`).

### Functional gap

| | multimodal-generate-text | generate-image-prompt |
|---|---|---|
| API | `generateText` (LLM) | `generateImage` (diffusion/image API) |
| Inputs | One chat message, text + images interleaved | Separate `images[]` + `text` |
| Strength | Instruction-following, faithful product/logo preservation, compositing/editing | Raw aesthetic polish, stylization |
| Weakness | Sometimes lower "wow" polish | Can drift from the exact product/brand details |

### Which produces a better image?

It is **model-dependent, not strategy-dependent** in the abstract. But for this use case (ad creative that must keep the actual product and brand logo accurate while following detailed prompt/branding instructions):

- **`multimodal-generate-text` (Gemini 3.1 Flash Image)** typically wins on **fidelity and instruction adherence** — it keeps the product looking like the product and respects brand context, because the LLM actually reasons about the inputs.
- **`generate-image-prompt`** models (especially **Imagen 4** and **Seedream 4**) often win on **pure visual polish/aesthetics**, but are more likely to subtly alter the product since reference images are only soft conditioning.

For a product-ad pipeline where the product must stay recognizable, the multimodal path is the safer "better image" bet. If you want a stylized hero shot and exact product accuracy matters less, the dedicated image models can look more striking. Practical answer: A/B Gemini 3.1 Flash Image vs. Imagen 4 on real product shots.

---

## Q: Where can I know if the model is a diffusion model? Can I change Gemini to just `generate-image-prompt`? Should the naming get better?

### 1. How do you know if a model is a diffusion model?

You **can't** tell from this codebase, and `imageStrategy` is *not* that signal. `imageStrategy` describes the **API surface** (which AI SDK function gets called — `generateText` vs `generateImage`), not the model's **architecture** (diffusion vs. autoregressive/multimodal LLM).

To know the actual architecture, check the source the file header already points at:

```
lib/models/registry.ts:1-6
https://vercel.com/ai-gateway/models?type=image
https://vercel.com/docs/ai-gateway
```

…or each provider's own model card. Rough reality today: Imagen 4, Seedream 4, GPT Image are diffusion/image-model style; Gemini *-flash-image is a multimodal LLM that emits images, not a classic diffusion model. None of that is derivable from code — it's external knowledge.

### 2. Can you switch Gemini to `generate-image-prompt`?

Not as a free toggle. The strategy must **match how the provider exposes that model through the gateway**:

- `generate-image-prompt` → `generateImage()` (`generate-ad-creative.ts:239`) — the dedicated image endpoint. Expects true image-generation models (Imagen, GPT Image, Seedream).
- `google/gemini-3.1-flash-image-preview` is served as a **multimodal text model**; its image output comes back as a file in the `generateText()` response (`generate-ad-creative.ts:221`).

If you flip Gemini's flag to `generate-image-prompt`, the code routes it into `generateImage()`, and the gateway will most likely reject it or return no image — that model isn't published on the image-generation endpoint. So: only change the strategy if the gateway actually serves that model under that API. For Gemini Flash Image, keep the text-model path.

### 3. Should the naming get better?

Yes — the original names leaked implementation and invited confusion ("is this about architecture?"). They really mean "which SDK call."

| Original | Clearer |
|---|---|
| `multimodal-generate-text` | `text-model` |
| `generate-image-prompt` | `image-model` |

`text-model` / `image-model` maps 1:1 to `generateText` vs `generateImage` and signals that it tracks *how the provider exposes the model*, not its internal architecture.

---

## Change applied

Renamed the `ImageStrategy` values across the codebase:

- `multimodal-generate-text` → `text-model`
- `generate-image-prompt` → `image-model`

Files touched:

- `lib/models/registry.ts` — `ImageStrategy` type + an explanatory doc comment, and all `imageStrategy` field values.
- `lib/ai/generate-ad-creative.ts` — the default fallback (line 167) and the strategy comparison (line 205).
