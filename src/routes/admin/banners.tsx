import { createFileRoute } from "@tanstack/react-router";
import { AdminPromos } from "./promos";

export const Route = createFileRoute("/admin/banners")({
  ssr: false,
  component: AdminBannersRoute,
});

function AdminBannersRoute() {
  return <AdminPromos defaultTab="banners" />;
}
