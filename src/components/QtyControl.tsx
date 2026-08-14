import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  slug: string;
  price_per_kg: number | string;
  images?: string[] | null;
  in_stock?: boolean;
}

export function QtyControl({ product, size = "sm", fullWidth = false }: { product: Product; size?: "sm" | "lg"; fullWidth?: boolean }) {
  const { items, add, update, remove } = useCart();
  const inCart = items.find((i) => i.product_id === product.id);

  if (!product.in_stock) {
    return <Button size={size} className={fullWidth ? "w-full" : ""} disabled>Out of stock</Button>;
  }

  if (!inCart) {
    return (
      <Button
        size={size}
        className={fullWidth ? "w-full bg-hero shadow-elegant" : ""}
        onClick={() => {
          add({ product_id: product.id, name: product.name, slug: product.slug, price_per_kg: Number(product.price_per_kg), image: product.images?.[0] ?? null }, 1);
          toast.success(`${product.name} added to cart`);
        }}
      >
        <ShoppingCart className={size === "lg" ? "mr-2 h-5 w-5" : "mr-1 h-4 w-4"} />Add to Cart
      </Button>
    );
  }

    const btn = size === "lg" ? "h-10 w-10" : "h-8 w-8";
    const next = +(inCart.qty_kg - 0.5).toFixed(2);
    return (
      <div className={`flex items-center justify-between gap-2 rounded-lg border-2 border-primary bg-primary/5 p-1 ${fullWidth ? "w-full" : ""}`}>
        <Button size="icon" variant="ghost" className={`${btn} text-primary hover:bg-primary/10`} onClick={() => next < 1 ? remove(product.id) : update(product.id, next)}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-sm font-bold text-primary">{inCart.qty_kg} kg</span>
        <Button size="icon" variant="ghost" className={`${btn} text-primary hover:bg-primary/10`} onClick={() => update(product.id, +(inCart.qty_kg + 0.5).toFixed(2))}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
}
