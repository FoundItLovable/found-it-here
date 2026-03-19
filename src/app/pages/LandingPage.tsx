import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { useLogoDestination } from '@/hooks/useLogoDestination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ReunitedMarquee } from '@/components/ReunitedMarquee';
import { OfficeLocationsMap } from '@/components/OfficeLocationsMap';
import { Reveal } from '@/components/motion/Reveal';
import { ParallaxBlob } from '@/components/motion/ParallaxBlob';
import { DottedSurface } from '@/components/ui/dotted-surface';
import { AdvancedMap } from '@/components/ui/interactive-map';
import { ImageAutoSlider } from '@/components/ui/image-auto-slider';
import { FeatureSteps, type FeatureStep } from '@/components/ui/feature-section';
import { getAllOffices, getPublicCatalogImageUrls, type OfficeRow } from '../../lib/database';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Star,
} from 'lucide-react';

export default function LandingPage() {
  const [reviewIndex, setReviewIndex] = useState(0);
  const logoTo = useLogoDestination();
  const [offices, setOffices] = useState<OfficeRow[]>([]);
  const [publicItemImages, setPublicItemImages] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    getAllOffices()
      .then((data) => {
        if (!mounted) return;
        setOffices(data ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setOffices([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getPublicCatalogImageUrls(36)
      .then((urls) => {
        if (!mounted) return;
        setPublicItemImages(urls ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setPublicItemImages([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const mapMarkers = useMemo(() => {
    const fromDb = offices
      .filter((o) => o.lat != null && o.lng != null && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng)))
      .map((o) => ({
        id: o.office_id,
        position: [Number(o.lat), Number(o.lng)] as [number, number],
        color: "green" as const,
        popup: {
          title: o.office_name ?? "Lost & Found Office",
          content: o.building_name ?? o.office_address ?? undefined,
        },
      }));

    // Ensure the map is never “empty” even if DB coords aren't set yet.
    if (fromDb.length > 0) return fromDb;

    return [
      {
        id: "norlin",
        position: [40.0095, -105.2729] as [number, number],
        color: "green" as const,
        popup: { title: "Norlin Library", content: "Central campus landmark" },
      },
      {
        id: "umc",
        position: [40.0062, -105.2721] as [number, number],
        color: "blue" as const,
        popup: { title: "UMC", content: "University Memorial Center" },
      },
      {
        id: "farrand",
        position: [40.0079, -105.2687] as [number, number],
        color: "orange" as const,
        popup: { title: "Farrand Field", content: "Popular meetup spot" },
      },
    ];
  }, [offices]);

  const reviews = [
    {
      id: 1,
      stars: 5,
      content:
        'FoundIt has completely streamlined how we track lost items on campus. Our return rates have increased by 40% since implementation.',
      author: 'Sarah Johnson',
      role: 'Director of Student Services, State University',
    },
    {
      id: 2,
      stars: 5,
      content:
        'Our staff loves it. What used to take 10 minutes now takes 30 seconds. The interface is intuitive and the search functionality is excellent.',
      author: 'Michael Chen',
      role: 'Front Desk Manager, Tech Campus',
    },
    {
      id: 3,
      stars: 5,
      content:
        'We handle hundreds of items per month and this is the first system that actually makes sense. The analytics help us staff appropriately.',
      author: 'Emily Rodriguez',
      role: 'Security Supervisor, Downtown Office Complex',
    },
    {
      id: 4,
      stars: 5,
      content:
        'The matching system is incredible. It automatically suggests potential matches which has saved us countless hours of manual searching.',
      author: 'David Kim',
      role: 'Operations Manager, Convention Center',
    },
  ];

  const features: FeatureStep[] = [
    {
      step: 'Quick Logging',
      title: 'Quick Logging',
      content: "Log found items in seconds with clean photos, descriptions, and precise locations.",
      image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=2400&q=85",
    },
    {
      step: 'Smart Matching',
      title: 'Smart Matching',
      content: "Students report what they lost and we surface the best matches instantly — no digging through bins.",
      image: "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=2400&q=85",
    },
    {
      step: 'Analytics Dashboard',
      title: 'Analytics Dashboard',
      content: "See trends by building, category, and time so you staff the right desk at the right time.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=2400&q=85",
    },
    {
      step: 'Automated Notifications',
      title: 'Automated Notifications',
      content: "Get notified when a potential match is logged — and reunite items faster with less back-and-forth.",
      image: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=2400&q=85",
    },
  ];

  const handleReviewScroll = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      setReviewIndex((prev) => (prev + 1) % reviews.length);
    } else {
      setReviewIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* High-tech animated background */}
      <DottedSurface className="opacity-[0.18] dark:opacity-[0.28]" />

      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-background/40 backdrop-blur-2xl shadow-lg shadow-black/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" to={logoTo} />
          <nav className="flex items-center gap-4 md:gap-8">
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              How It Works
            </button>
            <Link to="/browse">
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                Browse Catalog
              </Button>
            </Link>
            {/* <button
              onClick={() => scrollToSection('reviews')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reviews
            </button> */}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-x-hidden">
        {/* Cinematic hero image (lost & found / campus vibe) */}
        <img
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2400&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
          onError={(e) => {
            // Prevent broken-image placeholder showing under the logo if the hero image fails to load.
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/70 to-background" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-transparent" />
        <div className="absolute inset-0 overflow-hidden">
          <ParallaxBlob
            tintClassName="bg-primary/20"
            className="-top-32 -left-40 h-[520px] w-[520px]"
            strength={120}
          />
          <ParallaxBlob
            tintClassName="bg-sky-500/14"
            className="-bottom-40 -right-44 h-[560px] w-[560px]"
            strength={90}
          />
        </div>
        <div className="container mx-auto px-4 sm:px-6 relative w-full max-w-full">
          <div className="grid gap-12 items-center min-w-0">
            <div className="min-w-0">
              <div className="text-center lg:text-left space-y-6 min-w-0">
                <Reveal>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-0 justify-center lg:justify-start mx-auto lg:mx-0 w-fit"
                  >
                    Lost & Found Management
                  </Badge>
                </Reveal>
                <Reveal delay={60}>
                  <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight break-words">
                    The <span className="text-primary">Smart</span> Way to Manage Lost &amp; Found
                  </h1>
                </Reveal>
                <Reveal delay={110}>
                  <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 break-words">
                    A centralized platform for campuses and businesses to manage lost items, connect them with owners,
                    and streamline the entire recovery process.
                  </p>
                </Reveal>

                <Reveal delay={160}>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                    <Link to="/signup">
                      <Button size="lg" className="gap-2">
                        Get Started Free
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to="/browse">
                      <Button size="lg" variant="outline">
                        Browse Catalog
                      </Button>
                    </Link>
                    <Button size="lg" variant="outline" onClick={() => scrollToSection('how-it-works')}>
                      See How It Works
                    </Button>
                  </div>
                </Reveal>

                <Reveal delay={260}>
                  <div className="pt-4">
                    <ReunitedMarquee />
                  </div>
                </Reveal>
              </div>
            </div>
          </div>

          {/* <div className="grid grid-cols-3 gap-4 pt-12">
              <div className="space-y-1">
                <div className="text-2xl md:text-3xl font-bold text-primary">10K+</div>
                <p className="text-sm text-muted-foreground">Items Tracked</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl md:text-3xl font-bold text-primary">500+</div>
                <p className="text-sm text-muted-foreground">Organizations</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl md:text-3xl font-bold text-primary">85%</div>
                <p className="text-sm text-muted-foreground">Return Rate</p>
              </div>
            </div> */}
        </div>
      </section>

      {/* Commonly Lost Items (3D carousel) */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 space-y-10">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center space-y-3">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 w-fit mx-auto">
                Lost item gallery
              </Badge>
              <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
                The stuff students actually lose
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Spin through common campus items. Tap any photo to focus it.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="max-w-6xl mx-auto">
              <ImageAutoSlider images={publicItemImages} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 bg-card/30 border-y border-border/50">
        <FeatureSteps
          features={features}
          title="Built for Efficiency"
          className="bg-transparent"
          autoPlay
          autoPlayInterval={4500}
        />
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 md:py-32">
        <div className="container mx-auto px-4 space-y-12">
          <Reveal>
            <div className="max-w-2xl mx-auto text-center space-y-2">
              <h2 className="font-display text-3xl md:text-4xl font-bold">How It Works</h2>
              <p className="text-muted-foreground">
                Three simple steps to reunite items with their owners
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 md:gap-4">
            {[
              {
                number: '1',
                title: 'Log the Item',
                description:
                  'Staff finds an item and logs it into the system with a photo, description, and location details.',
              },
              {
                number: '2',
                title: 'Owner Reports',
                description:
                  'The owner searches for their lost item or submits a report describing what they lost.',
              },
              {
                number: '3',
                title: 'Match & Return',
                description:
                  'The system matches items to reports and provides a precise location, staff verifies ownership in person, and the item is returned.',
              },
            ].map((step, idx) => (
              <Reveal key={step.number} delay={idx * 100}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-lg mb-4">
                    {step.number}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {idx < 2 && (
                    <div className="hidden md:block mt-4 text-primary">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100}>
            <div className="max-w-2xl mx-auto bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-8 md:p-12 text-center space-y-4">
              <h3 className="font-display text-2xl font-bold">Ready to streamline your lost & found?</h3>
              <br/>
              <Link to="/admin">
                <Button size="lg">Access Admin Portal</Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Reviews Section
      <section id="reviews" className="py-20 md:py-32 bg-card/30 border-y border-border/50">
        <div className="container mx-auto px-4 space-y-12">
          <div className="max-w-2xl mx-auto text-center space-y-2">
            <h2 className="font-display text-3xl md:text-4xl font-bold">What Our Users Say</h2>
            <p className="text-muted-foreground">
              Trusted by universities, offices, and facilities nationwide
            </p>
          </div>

          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 md:left-2 top-0 z-10 hidden md:flex">
              <button
                onClick={() => handleReviewScroll('prev')}
                className="p-2 rounded-lg bg-background border border-border hover:bg-secondary transition-colors"
                aria-label="Previous review"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            <div
              key={reviewIndex}
              className="p-6 md:p-8 rounded-xl border border-border/50 bg-card space-y-4 animate-fade-in"
            >
              <div className="flex gap-1">
                {[...Array(reviews[reviewIndex].stars)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-foreground italic">"{reviews[reviewIndex].content}"</p>
              <div className="pt-2">
                <p className="font-semibold text-foreground">{reviews[reviewIndex].author}</p>
                <p className="text-sm text-muted-foreground">{reviews[reviewIndex].role}</p>
              </div>
            </div>

            <div className="absolute inset-y-1/2 -translate-y-1/2 right-0 md:right-2 top-0 z-10 hidden md:flex">
              <button
                onClick={() => handleReviewScroll('next')}
                className="p-2 rounded-lg bg-background border border-border hover:bg-secondary transition-colors"
                aria-label="Next review"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 justify-center mt-6 md:hidden">
              {reviews.map((_, idx) => (
                <button
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === reviewIndex ? 'bg-primary w-6' : 'bg-border'
                  }`}
                  onClick={() => setReviewIndex(idx)}
                  aria-label={`Review ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section> */}

      {/* CU Boulder interactive map */}
      <section className="py-20 md:py-28 bg-card/30 border-y border-border/50">
        <div className="container mx-auto px-4 space-y-10">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center space-y-3">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 w-fit mx-auto">
                Explore the campus
              </Badge>
              <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
                See lost &amp; found around CU Boulder
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Drag, zoom, cluster markers, and switch to satellite view.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="max-w-6xl mx-auto">
              <AdvancedMap
                center={[40.0076, -105.2659]}
                zoom={14}
                markers={mapMarkers}
                style={{ height: 520, width: "100%" }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <OfficeLocationsMap />

      {/* Final CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <Reveal>
            <div className="max-w-2xl mx-auto bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20 p-8 md:p-16 text-center space-y-6">
              <h2 className="font-display text-3xl md:text-4xl font-bold">
                Start Reuniting Lost Items Today
              </h2>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup">
                  <Button size="lg" className="gap-2">
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 py-12">
        <div className="container mx-auto px-4 space-y-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <Logo size="md" to={logoTo} />
              <p className="text-sm text-muted-foreground max-w-xs">
                Simplifying lost & found management for everyone
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Product</h4>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => scrollToSection('features')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  Features
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  How It Works
                </button>
                {/* <button
                  onClick={() => scrollToSection('reviews')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  Reviews
                </button> */}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Access</h4>
              <div className="flex flex-col gap-2">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  User Login
                </Link>
                <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign Up
                </Link>
                <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Admin Portal
                </Link>
              </div>
            </div>

            {/* <div className="space-y-3">
              <h4 className="font-semibold">Support</h4>
              <div className="flex flex-col gap-2">
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Help Center
                </a>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contact Us
                </a>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
              </div>
            </div> */}
          </div>

          <div className="border-t border-border/50 pt-8 text-center">
            {/* <p className="text-sm text-muted-foreground">
              &copy; 2024 FoundIt. All rights reserved.
            </p> */}
          </div>
        </div>
      </footer>
    </div>
  );
}
