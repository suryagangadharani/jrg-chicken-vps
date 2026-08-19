import { useState, useEffect } from "react";
import { notificationSounds } from "@/lib/notification-sounds";
import { Volume2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SoundUnlockBanner() {
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLocked(notificationSounds.isLocked());
  }, []);

  const handleUnlock = () => {
    notificationSounds.unlock();
    notificationSounds.play("normal_alert");
    setLocked(false);
    setUnlocked(true);
    setTimeout(() => setUnlocked(false), 4000);
  };

  if (unlocked) {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-600 font-medium flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Check className="h-4 w-4" /> Sound alerts enabled! You will hear loud chimes when new orders arrive.
        </span>
      </div>
    );
  }

  if (!locked) return null;

  return (
    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-amber-600 shrink-0 animate-bounce" />
        <span className="font-medium leading-snug">
          Click below to enable order sound alerts for this session.
        </span>
      </div>
      <Button
        onClick={handleUnlock}
        size="sm"
        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 rounded-xl"
      >
        Enable Sound Alerts 🔔
      </Button>
    </div>
  );
}
