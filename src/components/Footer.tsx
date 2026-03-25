import imiLogo from "@/assets/imi-logo.png";

const Footer = () => {
  return (
    <footer className="border-t bg-ambient/60 backdrop-blur-md mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <img src={imiLogo} alt="IMI Technologies" className="h-10 w-10 object-contain rounded" />
            <p className="text-sm font-medium text-foreground">
              Powered by <strong>IMI Technologies</strong>
            </p>
          </div>

          <div className="pt-3 border-t w-full">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} IMI Technologies. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
