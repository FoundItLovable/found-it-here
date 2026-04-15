import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signIn, getCurrentUserWithProfile } from "../../lib/auth";

// Swap this URL to change the login hero image (use /login-hero.jpg for a local image in public/)
const LOGIN_HERO_IMAGE =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { useLogoDestination } from "@/hooks/useLogoDestination";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Mail, Lock, ArrowLeft } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const logoTo = useLogoDestination();
  const from = (location.state as { from?: string })?.from ?? "/dashboard";
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const ping = async (url: string) => {
      const resp = await fetch(url, { method: "GET", cache: "no-store" });
      let body: unknown = null;
      try {
        body = await resp.json();
      } catch {
        body = null;
      }
      console.log("Wakeup ping result:", {
        url,
        ok: resp.ok,
        status: resp.status,
        reachedServer: true,
        body,
      });
      return resp;
    };

    void ping("/api/wakeup")
      .then(async (resp) => {
        if (resp.ok) return;
        console.warn("Wakeup endpoint returned non-2xx, trying fallback endpoint...");
        await ping("/api/stats/reunited");
      })
      .catch((err) => {
        console.warn("Wakeup ping failed before reaching server:", err);
      });
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);

      // After sign in, read role from the auth user object
      const userWithProfile = await getCurrentUserWithProfile();
      const role = userWithProfile?.profile?.role;

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      console.log("User role:", role);

      if (role === "staff") navigate("/admin");
      else navigate(from);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid email or password";
      console.error("Login error:", err);

      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Full-bleed background image */}
      <img
        src={LOGIN_HERO_IMAGE}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden
      />
      {/* Gradient overlay for readability and depth */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70"
        aria-hidden
      />
      {/* Soft ambient blobs (matches Signup) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full flex flex-col items-center justify-center p-4 md:p-8 min-h-screen overflow-y-auto">
        <Card className="relative w-full max-w-md glass-card shadow-2xl animate-fade-in bg-card/95 backdrop-blur-xl">
          <Link to="/" className="absolute left-4 top-4 z-10">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <Logo to={logoTo} />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription>Sign in to your FoundIt account</CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="email" placeholder="your.name@colorado.edu" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="password" placeholder="••••••••" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/signup" className="text-primary hover:underline font-medium">
                    Create one
                  </Link>
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-white/80 drop-shadow-sm">
          University of Colorado Boulder
        </p>
      </div>
    </div>
  );
}
