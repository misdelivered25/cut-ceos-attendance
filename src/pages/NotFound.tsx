import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import logo from "@/assets/cut-ceos-logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <img src={logo} alt="CUT CEOS" className="mx-auto h-24 w-24 object-contain mb-4" />
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <h1 className="text-4xl font-bold">404</h1>
          <p className="text-xl text-muted-foreground">Oops! Page not found</p>
          <Button asChild className="mt-4">
            <a href="/">Return to Home</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
