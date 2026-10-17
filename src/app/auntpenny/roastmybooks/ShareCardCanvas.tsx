"use client";

import { useRef, useState } from "react";
import type { RoastReport } from "@/lib/auntpenny/roast-engine";

/**
 * Privacy-safe share card (MVP spec section 7), revised to the founder's light
 * Aunt Penny brand: ivory certificate, gold double frame, the approved
 * character cameo. A real 1080x1080 PNG drawn entirely in the customer's
 * browser. The card prints the verdict tier, ONE quip and an optional first
 * name only. Never figures, business name, or dates.
 */
export function ShareCardDownload({ report, firstName }: { report: RoastReport; firstName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  const draw = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = 1080;
    canvas.width = S;
    canvas.height = S;

    // Ivory paper with a soft blush glow.
    ctx.fillStyle = "#fbf7f2";
    ctx.fillRect(0, 0, S, S);
    const glow = ctx.createRadialGradient(S * 0.72, S * 0.1, 40, S * 0.72, S * 0.1, 560);
    glow.addColorStop(0, "rgba(247, 228, 231, 0.9)");
    glow.addColorStop(1, "rgba(247, 228, 231, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, S, S);

    // Double gold frame.
    ctx.strokeStyle = "#b8892e";
    ctx.lineWidth = 10;
    ctx.strokeRect(34, 34, S - 68, S - 68);
    ctx.lineWidth = 3;
    ctx.strokeRect(58, 58, S - 116, S - 116);

    // The approved character cameo, centered near the top.
    try {
      const img = new Image();
      img.src = "/auntpenny/penny-serious.jpg";
      await img.decode();
      const d = 300;
      const cx = S / 2 - d / 2;
      const cy = 120;
      const r = d / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + r, cy + r, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Cover-fit the source crop into the circle.
      const scale = Math.max(d / img.width, d / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      ctx.drawImage(img, cx + (d - iw) / 2, cy + (d - ih) / 2, iw, ih);
      ctx.restore();
      ctx.strokeStyle = "#e9d5a4";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx + r, cy + r, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    } catch {
      // Art missing: proceed without the cameo rather than fail the card.
    }

    ctx.textAlign = "center";

    // Seal.
    ctx.fillStyle = "#8a6a1f";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText("C E R T I F I E D   B Y   R O A S T   M Y   B O O K S", S / 2, 510);

    // Tier name.
    ctx.fillStyle = "#4a2140";
    ctx.font = "bold 72px Georgia, serif";
    const lines = wrap(ctx, report.tierName, S - 220);
    let y = 585 - (lines.length - 1) * 44;
    for (const line of lines) {
      ctx.fillText(line, S / 2, y);
      y += 88;
    }

    // The quip.
    ctx.fillStyle = "#3d1c36";
    ctx.font = "italic 42px Georgia, serif";
    const quipLines = wrap(ctx, `"${report.funniestQuote}"`, S - 260);
    y = Math.max(y + 26, 700);
    for (const line of quipLines) {
      ctx.fillText(line, S / 2, y);
      y += 58;
    }

    if (firstName) {
      ctx.font = "italic 34px Georgia, serif";
      ctx.fillStyle = "rgba(61, 28, 54, 0.75)";
      ctx.fillText(`${firstName}'s books, officially rated.`, S / 2, S - 200);
    }

    // Bottom mark.
    ctx.fillStyle = "#b8892e";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText("AUNT PENNY, ROAST MY BOOKS!", S / 2, S - 100);

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
