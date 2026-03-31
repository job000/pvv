import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-muted/30 px-4 py-16 sm:px-6">
      <Card className="w-full max-w-lg shadow-md">
        <CardHeader className="space-y-3 text-center sm:text-left">
          <div className="flex justify-center sm:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-muted-foreground text-xs">
              <Sparkles className="size-3.5" />
              PVV
            </span>
          </div>
          <CardTitle className="font-heading text-3xl tracking-tight">
            Prosess vurdering verktøy
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Vurder RPA-kandidater med tydelig matematikk — i tråd med UiPath
            Automation Hub (automatiseringspotensial, gjennomførbarhet,
            implementasjon og årlige KPI-er).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground text-sm sm:text-left">
            Tailwind CSS og shadcn/ui gir konsistent layout, tilgjengelige
            kontroller og responsivt grensesnitt.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-start">
          <Button
            size="lg"
            className="gap-2"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            Logg inn og start
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            Har du ikke konto?
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
