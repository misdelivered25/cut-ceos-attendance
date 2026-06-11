import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, MessageCircle, Printer, Users, Clock } from "lucide-react";
import { toast } from "sonner";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    title: string;
    qr_token: string;
    end_time?: string | null;
    time_limit_enabled?: boolean;
    is_active?: boolean;
  };
}

export const QRCodeDialog = ({ open, onOpenChange, session }: QRCodeDialogProps) => {
  const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
  const attendanceUrl = `${String(PUBLIC_APP_URL).replace(/\/$/, "")}/scan/${session.qr_token}`;
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // Live attendee count — refreshes every 5 seconds while dialog is open
  const { data: count } = useQuery({
    queryKey: ["qr-live-count", session.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendees")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  // Countdown timer for timed sessions
  useEffect(() => {
    if (!open || !session.time_limit_enabled || !session.end_time) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const diff = new Date(session.end_time!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [open, session.end_time, session.time_limit_enabled]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(attendanceUrl);
    toast.success("URL copied to clipboard!");
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement("a");
      link.download = `qr-${session.title.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `📋 *${session.title}*\nMark your attendance here:\n${attendanceUrl}`
  )}`;

  const handlePrint = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>QR Code – ${session.title}</title>
  <style>
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;
         min-height:100vh;font-family:sans-serif;padding:24px;text-align:center}
    h2{margin:0 0 4px;font-size:22px}
    p{color:#555;margin:0 0 20px;font-size:13px;max-width:300px;word-break:break-all}
    img{width:280px;height:280px}
    small{color:#999;margin-top:16px;font-size:11px}
  </style>
</head>
<body>
  <h2>${session.title}</h2>
  <p>Scan to mark attendance</p>
  <img src="data:image/svg+xml;base64,${btoa(svgData)}" />
  <p>${attendanceUrl}</p>
  <small>Powered by IMI Technologies</small>
  <script>window.onload=()=>{window.print();window.close();}<\/script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{session.title}</DialogTitle>
          <DialogDescription>Share this QR code for attendance tracking</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-2">
          {/* Live stats bar */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
              <Users className="h-3.5 w-3.5" />
              {count ?? 0} checked in
            </Badge>
            {timeLeft && (
              <Badge
                variant={timeLeft === "Expired" ? "destructive" : "outline"}
                className="gap-1.5 px-3 py-1 text-sm"
              >
                <Clock className="h-3.5 w-3.5" />
                {timeLeft === "Expired" ? "Session expired" : `${timeLeft} remaining`}
              </Badge>
            )}
          </div>

          {/* QR Code */}
          <div className="rounded-xl bg-white p-4 shadow-md ring-1 ring-black/5">
            <QRCodeSVG
              id="qr-code-svg"
              value={attendanceUrl}
              size={240}
              level="H"
              includeMargin
            />
          </div>

          {/* URL display */}
          <div className="w-full rounded-md border bg-muted p-3">
            <p className="break-all text-sm text-center">{attendanceUrl}</p>
          </div>

          {/* Action buttons – 2×2 grid */}
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleCopyUrl}>
              <Copy className="mr-2 h-4 w-4" />
              Copy URL
            </Button>
            <Button variant="outline" onClick={handleDownloadQR}>
              <Download className="mr-2 h-4 w-4" />
              Download QR
            </Button>
            <Button
              variant="outline"
              asChild
              className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400"
            >
              <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
