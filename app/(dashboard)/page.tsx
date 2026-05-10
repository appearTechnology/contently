import Link from "next/link";
import { ArrowRight, ImagePlus, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getModelsForCapability } from "@/lib/models/registry";

export default function HomePage() {
  const photoModels = getModelsForCapability("image");
  const videoModels = getModelsForCapability("video");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-8">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-2xl">
            <Sparkles className="size-6" aria-hidden />
            Welcome to Ad Studio
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-relaxed">
            Turn a product photo and a short brief into a polished paid-social
            still. Upload, describe the ad, pick a gateway model, and ship.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="gap-2"
            nativeButton={false}
            render={<Link href="/generate" />}
          >
            <ImagePlus className="size-4" aria-hidden />
            Start generating
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Photo models
          </h2>
          <p className="text-muted-foreground text-sm">
            Configured in <code>lib/models/registry.ts</code>. Add or swap entries
            to change what appears in the generator.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {photoModels.map((m) => (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="text-base">{m.label}</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {m.gatewayModel}
                </CardDescription>
              </CardHeader>
              {m.description ? (
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {m.description}
                  </p>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="size-4" aria-hidden />
            Video output
          </CardTitle>
          <CardDescription>
            {videoModels.length > 0
              ? `${videoModels.length} video model${videoModels.length === 1 ? "" : "s"} ready to use from the generator.`
              : "No video models registered yet. Add one with the `video` capability in lib/models/registry.ts and wire it in lib/ai/generate-ad-creative.ts."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
