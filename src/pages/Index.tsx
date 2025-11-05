import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { QrCode, Clock, Shield, Smartphone, Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";
import logo from "@/assets/cut-ceos-logo.png";
import Footer from "@/components/Footer";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
const Index = () => {
  const navigate = useNavigate();
  const hero = useScrollAnimation(0.1);
  const features = useScrollAnimation(0.1);
  const howItWorks = useScrollAnimation(0.1);
  const about = useScrollAnimation(0.1);
  const contact = useScrollAnimation(0.1);
  const cta = useScrollAnimation(0.1);
  return <div className="flex min-h-screen flex-col bg-mesh-gradient">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={logo} alt="CUT CEOS" className="h-10 w-10 object-contain" />
            <span className="text-xl font-bold">CUT CEOS Attendance</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={hero.ref} className={`container mx-auto px-4 py-20 md:py-32 transition-all duration-1000 ${hero.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <img src={logo} alt="CUT CEOS" className="h-32 w-32 object-contain md:h-40 md:w-40" />
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            Modern Attendance Tracking
            <span className="block text-primary">Made Simple</span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground md:text-xl lg:text-2xl">
            Say goodbye to paperwork. Track attendance with QR codes in seconds.
            Built for the future of education.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="text-lg" onClick={() => navigate("/auth")}>
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="text-lg" onClick={() => {
            document.getElementById('contact')?.scrollIntoView({
              behavior: 'smooth'
            });
          }}>
              Contact Us
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={features.ref} className={`container mx-auto px-4 py-20 transition-all duration-1000 delay-200 ${features.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Why Choose Our System?</h2>
          <p className="text-lg text-muted-foreground">
            Powerful features designed to save time and reduce paperwork
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <QrCode className="mb-2 h-12 w-12 text-primary" />
              <CardTitle>QR Code Scanning</CardTitle>
              <CardDescription>
                Generate unique QR codes for each session. Students scan and register instantly.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <Clock className="mb-2 h-12 w-12 text-primary" />
              <CardTitle>Auto-Expiry</CardTitle>
              <CardDescription>
                Sessions automatically expire after 2 hours, ensuring security and accuracy.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <Shield className="mb-2 h-12 w-12 text-primary" />
              <CardTitle>IP Tracking</CardTitle>
              <CardDescription>
                Every attendance record captures IP addresses for enhanced verification.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <Smartphone className="mb-2 h-12 w-12 text-primary" />
              <CardTitle>Mobile First</CardTitle>
              <CardDescription>
                Fully responsive design works perfectly on any device, anywhere.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorks.ref} className={`bg-muted/30 py-20 transition-all duration-1000 delay-300 ${howItWorks.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">How It Works</h2>
            <p className="text-lg text-muted-foreground">
              Three simple steps to modernize your attendance tracking
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                1
              </div>
              <h3 className="mb-2 text-xl font-bold">Create Session</h3>
              <p className="text-muted-foreground">
                Create an attendance session with a unique QR code in seconds
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                2
              </div>
              <h3 className="mb-2 text-xl font-bold">Share QR Code</h3>
              <p className="text-muted-foreground">
                Display or share the QR code with your students or attendees
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                3
              </div>
              <h3 className="mb-2 text-xl font-bold">Track & Export</h3>
              <p className="text-muted-foreground">
                View real-time attendance and export records to Excel
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section ref={about.ref} className={`container mx-auto px-4 py-20 transition-all duration-1000 delay-200 ${about.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mx-auto max-w-4xl">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-3xl">About Our Mission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-primary" />
                <p>
                  A product of <strong className="text-foreground">HGC Private Limited</strong>, proudly sponsored by{" "}
                  <strong className="text-foreground">Tatenda Foundation</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-primary" />
                <p>
                  Created by CEO and Founder <strong className="text-foreground">Mr. Miguel Hore</strong> to reduce unnecessary paperwork in attendance tracking
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-primary" />
                <p>
                  Aligning with <strong className="text-foreground">His Excellency, President Emmerson Mnangagwa's 2030 Vision</strong> to modernize and develop infrastructure across the country
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section ref={contact.ref} id="contact" className={`bg-muted/30 py-20 transition-all duration-1000 delay-300 ${contact.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Get In Touch</h2>
            <p className="text-lg text-muted-foreground">
              Have questions? We'd love to hear from you.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            <Card className="text-center">
              <CardHeader>
                <Mail className="mx-auto mb-2 h-10 w-10 text-primary" />
                <CardTitle>Email</CardTitle>
                <CardDescription className="break-all">
                  <a href="mailto:info@hgcprivatelimited.com" className="hover:text-primary">
                    info@hgcprivatelimited.com
                  </a>
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <Phone className="mx-auto mb-2 h-10 w-10 text-primary" />
                <CardTitle>Phone</CardTitle>
                <CardDescription>
                  <a href="tel:+263712345678" className="hover:text-primary">+263 785 693 657</a>
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <MapPin className="mx-auto mb-2 h-10 w-10 text-primary" />
                <CardTitle>Location</CardTitle>
                <CardDescription>
                  Chinhoyi University of Technology, Zimbabwe
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={cta.ref} className={`container mx-auto px-4 py-20 transition-all duration-1000 delay-200 ${cta.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mx-auto max-w-3xl rounded-2xl bg-primary p-8 text-center text-primary-foreground md:p-12">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Ready to Modernize Your Attendance?
          </h2>
          <p className="mb-8 text-lg opacity-90">
            Join the movement towards paperless, efficient attendance tracking
          </p>
          <Button size="lg" variant="secondary" className="text-lg" onClick={() => navigate("/auth")}>
            Get Started Now
          </Button>
        </div>
      </section>

      <Footer />
    </div>;
};
export default Index;