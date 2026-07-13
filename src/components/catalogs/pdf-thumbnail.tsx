"use client";

import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";

type PreviewState = "loading" | "ready" | "unavailable";

export function PdfThumbnail({ title, url }: Readonly<{ title: string; url: string }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PreviewState>("loading");

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    let renderTask: RenderTask | undefined;

    async function renderPreview() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        loadingTask = pdfjs.getDocument({ url, withCredentials: false });
        const document = await loadingTask.promise;
        const page = await document.getPage(1);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");

        if (!active || canvas === null || context == null) return;

        const source = page.getViewport({ scale: 1 });
        const scale = 360 / source.width;
        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        context.scale(pixelRatio, pixelRatio);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (active) setState("ready");
      } catch {
        if (active) setState("unavailable");
      }
    }

    void renderPreview();

    return () => {
      active = false;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [url]);

  return (
    <div className="relative aspect-[8.5/11] overflow-hidden bg-nh-surface-muted">
      {state !== "unavailable" ? <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 m-auto max-h-full max-w-full transition-opacity duration-300 ease-in-out ${state === "ready" ? "opacity-100" : "opacity-0"}`} /> : null}
      {state === "loading" ? <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-nh-surface-muted" /> : null}
      {state === "unavailable" ? (
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-nh-surface-muted px-6 text-center">
          <FileText className="size-7 text-nh-muted" />
          <span className="text-[12px] leading-[18px] text-nh-muted">{title}</span>
        </div>
      ) : null}
    </div>
  );
}
