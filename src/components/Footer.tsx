import hgcLogo from "@/assets/hgc-logo.png";
import tatendaLogo from "@/assets/tatenda-logo.png";

const Footer = () => {
  return (
    <footer className="border-t bg-card/50 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Logos */}
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="flex flex-col items-center gap-2">
              <img src={hgcLogo} alt="HGC Private Limited" className="h-16 w-16 object-contain" />
              <p className="text-xs text-muted-foreground font-medium">HGC Private Limited</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <img src={tatendaLogo} alt="Tatenda Foundation" className="h-16 w-16 object-contain" />
              <p className="text-xs text-muted-foreground font-medium">Tatenda Foundation</p>
            </div>
          </div>

          {/* Main Text */}
          <div className="max-w-3xl space-y-3">
            <p className="text-sm text-muted-foreground">
              A product of <strong className="text-foreground">HGC Private Limited</strong>, proudly sponsored by <strong className="text-foreground">Tatenda Foundation</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Created by CEO and Founder <strong className="text-foreground">Mr. Miguel Hore</strong> to reduce unnecessary paperwork in attendance tracking
            </p>
            <p className="text-sm text-muted-foreground">
              Aligning with <strong className="text-foreground">His Excellency, President Emmerson Mnangagwa's 2030 Vision</strong> to modernize and develop infrastructure across the country
            </p>
          </div>

          {/* Copyright */}
          <div className="pt-4 border-t w-full">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} HGC Private Limited. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
