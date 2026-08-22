import { createFileRoute } from "@tanstack/react-router";
import { AdminPromos } from "./promos";

export const Route = createFileRoute("/admin/categories")({
  ssr: false,
  component: AdminCategoriesRoute,
});

function AdminCategoriesRoute() {
  return <AdminPromos defaultTab="categories" />;
}
