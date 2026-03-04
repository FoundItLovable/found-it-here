import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signUp } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { useLogoDestination } from "@/hooks/useLogoDestination";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Mail, Lock, User, Phone, IdCard } from "lucide-react";

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  organizationId: z.string().uuid("Please select your organization"),
  phoneNumber: z.string().optional(),
  studentId: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;
type OrganizationOption = { organization_id: string; name: string };

export default function Signup() {
  const navigate = useNavigate();
  const logoTo = useLogoDestination();
  const [isLoading, setIsLoading] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      organizationId: "",
      phoneNumber: "",
      studentId: "",
    },
  });

  useEffect(() => {
    let mounted = true;
    const loadOrganizations = async () => {
      setOrgLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("organization_id,name")
        .order("name", { ascending: true });

      if (!mounted) return;
      if (error) {
        toast({
          title: "Could not load organizations",
          description: error.message,
          variant: "destructive",
        });
        setOrganizations([]);
      } else {
        setOrganizations((data ?? []) as OrganizationOption[]);
      }
      setOrgLoading(false);
    };

    void loadOrganizations();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      await signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        organizationId: data.organizationId,
        phoneNumber: data.phoneNumber,
        studentId: data.studentId,
      });

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });

      navigate("/login");
    } catch (err: unknown) {
      console.error("Signup error:", err);

      let message = "Could not create account";
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        message = String((err as { message: unknown }).message);
      }

      toast({
        title: "Signup failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass-card relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo to={logoTo} />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Sign up for a FoundIt account</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="John Doe" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
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

              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={orgLoading || isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={orgLoading ? "Loading organizations..." : "Select organization"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.organization_id} value={org.organization_id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="tel" placeholder="(555) 123-4567" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID (optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="123456789" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
