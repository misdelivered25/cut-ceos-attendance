import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    title: string;
    qr_token: string;
  };
}

export const QRCodeDialog = ({ open, onOpenChange, session }: QRCodeDialogProps) => {
  const attendanceUrl = `${window.location.origin}/scan/${session.qr_token}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(attendanceUrl);
    toast.success("URL copied to clipboard!");
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `qr-${session.title.replace(/\s+/g, "-")}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{session.title}</DialogTitle>
          <DialogDescription>
            Share this QR code for attendance tracking
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="rounded-lg bg-white p-4">
            <QRCodeSVG
              id="qr-code"
              value={attendanceUrl}
              size={256}
              level="H"
              includeMargin
            />
          </div>
          <div className="w-full space-y-2">
            <div className="rounded-md border bg-muted p-3">
              <p className="break-all text-sm">{attendanceUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyUrl}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDownloadQR}
              >
                Download QR
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
