import { cn } from "@/lib/utils";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={cn("pk-brand", light && "pk-brand-light")}>
      <span className="pk-monogram" aria-hidden="true">
        PK<span>.</span>
      </span>
      <span className="pk-brand-name">
        PK Business Services<span>People | Knowledge | Results</span>
      </span>
    </span>
  );
}
