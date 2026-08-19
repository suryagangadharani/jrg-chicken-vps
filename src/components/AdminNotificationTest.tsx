import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { notificationSounds, getSoundSettings, saveSoundSettings, type SoundType } from "@/lib/notification-sounds";
import { toast } from "sonner";
import { BellRing, Volume2, VolumeX, Send, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export function AdminNotificationTest() {
  const [settings, setSettings] = useState(getSoundSettings());
  const [fcmPermission, setFcmPermission] = useState<string>("default");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setFcmPermission(Notification.permission);
    }
  }, []);

  const handleToggleSound = (enabled: boolean) => {
    const updated = saveSoundSettings({ soundEnabled: enabled });
    if (updated) setSettings(updated);
    toast.success(`Notification audio ${enabled ? "enabled 🔔" : "muted 🔇"}`);
  };

  const handleVolumeChange = (values: number[]) => {
    const vol = values[0] / 100;
    const updated = saveSoundSettings({ volume: vol });
    if (updated) setSettings(updated);
  };

  const playTestSound = (type: SoundType) => {
    notificationSounds.play(type);
    toast.info(`Playing ${type.replace(/_/g, " ")} audio sample...`);
  };

  const sendTestNotification = async (soundType: SoundType) => {
    setIsSending(true);
    try {
      await apiClient.notifications.sendTestNotification({
        soundType,
        title: soundType === "loud_alert" ? "🔔 LOUD ORDER ALERT TEST" : "✅ Order Status Update Test",
        message: "This is a live notification test. Real-time popup, push, and audio chime verified!",
      });
      toast.success("Test notification dispatched!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send test notification");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-foreground leading-tight">
              Notification & Alert Settings
            </h3>
            <p className="text-xs text-muted-foreground">Test in-app popups, loud chimes, and push notifications.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Browser FCM: {fcmPermission.toUpperCase()}</span>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary/50 p-3.5 space-y-2 border border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <Label htmlFor="sound-switch" className="font-semibold text-xs">
                In-App Alert Chimes
              </Label>
            </div>
            <Switch
              id="sound-switch"
              checked={settings.soundEnabled}
              onCheckedChange={handleToggleSound}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Plays custom chimes for new orders and status updates when browser permits.
          </p>
        </div>

        <div className="rounded-xl bg-secondary/50 p-3.5 space-y-2 border border-border/60">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Alert Volume</span>
            <span className="text-primary">{Math.round(settings.volume * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(settings.volume * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={handleVolumeChange}
            disabled={!settings.soundEnabled}
          />
        </div>
      </div>

      {/* Live Dispatch Test Suite */}
      <div className="space-y-2 pt-1">
        <Label className="text-xs font-semibold text-muted-foreground">Live Notification Test Suite</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            onClick={() => sendTestNotification("loud_alert")}
            disabled={isSending}
            className="bg-primary text-primary-foreground text-xs gap-1.5 h-9"
          >
            <Send className="h-3.5 w-3.5" />
            Send Loud Alert Test
          </Button>

          <Button
            onClick={() => sendTestNotification("normal_alert")}
            disabled={isSending}
            variant="outline"
            className="text-xs gap-1.5 h-9"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
            Send Normal Alert Test
          </Button>

          <Button
            onClick={() => playTestSound("loud_alert")}
            variant="secondary"
            className="text-xs gap-1.5 h-9"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Preview Sound Chime
          </Button>
        </div>
      </div>
    </div>
  );
}
