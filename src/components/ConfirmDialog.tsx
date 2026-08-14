import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => unknown | Promise<unknown>;
};

export function ConfirmDialog({
  children,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm rounded-2xl border-border/60 bg-card p-0 shadow-elegant sm:max-w-md">
        <div className="flex items-start gap-3 p-5 sm:p-6">
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full",
              destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <AlertDialogHeader className="space-y-1 text-left">
            <AlertDialogTitle className="font-display text-lg">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="flex-row justify-end gap-2 border-t border-border/60 bg-secondary/30 px-5 py-3 sm:px-6">
          <AlertDialogCancel className="mt-0 rounded-full">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className={cn(
              "rounded-full shadow-elegant",
              destructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive",
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
