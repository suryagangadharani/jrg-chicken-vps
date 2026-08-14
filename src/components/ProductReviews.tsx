import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { dateFmt } from "@/lib/format";

export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [reviews] = useState<any[]>([]);

  useEffect(() => {
    // Optional reviews loading
  }, [productId, user?.id]);

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Customer Reviews</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Stars value={avg} />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {reviews.length === 0 && <div className="text-sm text-muted-foreground">No reviews yet.</div>}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{r.customer_name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Stars value={r.rating} />
                  <span>{dateFmt(r.created_at)}</span>
                </div>
              </div>
            </div>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= Math.round(value) ? "fill-warning text-warning" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
}
