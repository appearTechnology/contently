import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { extractBrandingFromPdfText } from "@/lib/branding/import-pdf/extract-with-llm";
import { mergePdfBrandingIntoExistingKit } from "@/lib/branding/import-pdf/merge-into-kit";
import { parseBrandGuidePdf } from "@/lib/branding/import-pdf/parse-pdf-text";
import {
  BrandingStoreError,
  getBrandingKitView,
  upsertBrandingKit,
} from "@/lib/branding/server-store";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MIN_TEXT_CHARS_FOR_CONFIDENT_IMPORT = 120;

function isPdfFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf") return true;
  const name = file.name?.toLowerCase() ?? "";
  return name.endsWith(".pdf");
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "A non-empty PDF file is required (field name: pdf)." },
      { status: 400 },
    );
  }

  if (!isPdfFile(file)) {
    return NextResponse.json(
      { error: "Upload must be a PDF (.pdf or application/pdf)." },
      { status: 400 },
    );
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      {
        error: `PDF must be at most ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
      },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const parsed = await parseBrandGuidePdf(buffer);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const warnings: string[] = [];
  if (parsed.truncated) {
    warnings.push(
      `Only the first ~${parsed.textForModel.length.toLocaleString()} characters of PDF text were sent to the model (full extract was ${parsed.rawCharCount.toLocaleString()} characters). Consider splitting very large guides.`,
    );
  }
  if (parsed.rawCharCount < MIN_TEXT_CHARS_FOR_CONFIDENT_IMPORT) {
    warnings.push(
      "Very little text was extracted — the PDF may be mostly images or scans. Results may be sparse; OCR or a text-exported PDF works best.",
    );
  }

  const llm = await extractBrandingFromPdfText({
    text: parsed.textForModel,
    pageCount: parsed.pageCount,
  });
  if (!llm.ok) {
    return NextResponse.json({ error: llm.error }, { status: 502 });
  }

  const existingView = await getBrandingKitView(userId);
  const { kit, inferredAny } = mergePdfBrandingIntoExistingKit(
    existingView.kit,
    llm.data,
  );

  if (!inferredAny) {
    warnings.push(
      "The model did not return any non-empty fields from this PDF. Your saved kit was left unchanged.",
    );
    return NextResponse.json({
      view: existingView,
      warnings,
    });
  }

  try {
    const view = await upsertBrandingKit({ userId, kit });
    return NextResponse.json({ view, warnings });
  } catch (err) {
    if (err instanceof BrandingStoreError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          ...(err.hint ? { hint: err.hint } : {}),
        },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : "Save failed";
    console.error("[api/branding/import-pdf]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
