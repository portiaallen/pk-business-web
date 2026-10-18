"use client";

import { useRef, useState } from "react";
import type { RoastReport } from "@/lib/auntpenny/roast-engine";

/**
 * Privacy-safe share card (MVP spec section 7): a real 1080x1080 PNG drawn
 * entirely in the customer's browser. The card prints the verdict tier, ONE
 * quip and an optional first name only. Never figures, business name, or dates.
 */
export function ShareCardDownload({ report, firstName }: { report: RoastReport; firstName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = 1080;
    canvas.width = S;
    canvas.height = S;

    // Deep plum gradient with a hot-pink glow, Aunt Penny brand world.
    const grad = ctx.createLinearGradient(0, S, S, 0);
    grad.addColorStop(0, "#1d0c26");
    grad.addColorStop(1, "#2a1236");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    const glow = ctx.createRadialGradient(S * 0.75, S * 0.2, 40, S * 0.75, S * 0.2, 520);
    glow.addColorStop(0, "rgba(255, 79, 160, 0.28)");
    glow.addColorStop(1, "rgba(255, 79, 160, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, S, S);

    // Double gold frame.
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 10;
    ctx.strokeRect(34, 34, S - 68, S - 68);
    ctx.lineWidth = 3;
    ctx.strokeRect(58, 58, S - 116, S - 116);

    ctx.textAlign = "center";

    // Seal.
    ctx.fillStyle = "#f0d9a8";
    ctx.font = "600 30px system-ui, sans-serif";
    ctx.fillText("C E R T I F I E D   B Y   R O A S T   M Y   B O O K S", S / 2, 168);

    // Tier name.
    ctx.fillStyle = "#fdf6ec";
    ctx.font = "bold 76px Georgia, serif";
    const tierName = report.tierName;
    const lines = wrap(ctx, tierName, S - 220);
    let y = 470 - (lines.length - 1) * 44;
    for (const line of lines) {
      ctx.fillText(line, S / 2, y);
      y += 92;
    }

    // The quip.
    ctx.fillStyle = "rgba(253, 246, 236, 0.92)";
    ctx.font = "44px Georgia, serif";
    const quipLines = wrap(ctx, `“${report.funniestQuote}”`, S - 260);
    y = Math.max(y + 30, 660);
    for (const line of quipLines) {
      ctx.fillText(line, S / 2, y);
      y += 60;
    }

    if (firstName) {
      ctx.font = "italic 36px Georgia, serif";
      ctx.fillStyle = "rgba(253, 246, 236, 0.75)";
      ctx.fillText(`${firstName}'s books, officially rated.`, S / 2, S - 210);
    }

    // Bottom mark.
    ctx.fillStyle = "#d9a441";
    ctx.font = "600 30px system-ui, sans-serif";
    ctx.fillText("AUNT PENNY, ROAST MY BOOKS!", S / 2, S - 110);

    setReady(true);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "roast-my-books-share-card.png";
    a.click();
  };

  return (
    <div className="ap-no-print mt-6 flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {!ready ? (
        <button className="ap-cta" type="button" onClick={draw}>
          Make my 1080×1080 share card
        </button>
      ) : (
        <button className="ap-cta" type="button" onClick={download}>
          Download share card (PNG)
        </button>
      )}
    </div>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
