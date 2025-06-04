
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, TrendingUp, Users, Target, Briefcase, Zap } from 'lucide-react';
import { Logo } from '@/components/icons/Logo'; // Assuming logo can be used standalone

const features = [
  {
    icon: <Briefcase className="h-10 w-10 text-primary mb-4" />,
    title: 'Track Job Openings',
    description: 'Never lose sight of an opportunity. Organize and monitor job applications seamlessly.',
    dataAiHint: 'job search'
  },
  {
    icon: <Users className="h-10 w-10 text-primary mb-4" />,
    title: 'Manage Contacts',
    description: 'Build and maintain your professional network with our intuitive contact management system.',
    dataAiHint: 'networking people'
  },
  {
    icon: <TrendingUp className="h-10 w-10 text-primary mb-4" />,
    title: 'Automated Follow-ups',
    description: 'Stay top-of-mind with scheduled follow-up reminders and email templates.',
    dataAiHint: 'email marketing'
  },
  {
    icon: <Target className="h-10 w-10 text-primary mb-4" />,
    title: 'Company Directory',
    description: 'Keep detailed records of target companies and your interactions with them.',
    dataAiHint: 'business office'
  },
];

const testimonials = [
  {
    quote: "ProspectFlow revolutionized how I manage my job search. I'm more organized and follow up more effectively!",
    name: 'Alex P.',
    role: 'Software Engineer',
    avatar: 'https://placehold.co/100x100.png',
    dataAiHint: 'person portrait'
  },
  {
    quote: "As a sales professional, keeping track of leads and follow-ups is crucial. ProspectFlow makes it effortless.",
    name: 'Sarah K.',
    role: 'Sales Manager',
    avatar: 'https://placehold.co/100x100.png',
    dataAiHint: 'professional woman'
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-6">
          <Link href="/landing" className="mr-6 flex items-center space-x-2">
            <Logo />
          </Link>
          <nav className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
            <Button asChild className="shadow-lg">
              <Link href="/auth?action=signup">Sign Up Free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 text-center bg-background shadow-inner">
          <div className="container px-4 md:px-6">
            <Zap className="mx-auto h-16 w-16 text-primary mb-6" />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 font-headline text-foreground">
              Supercharge Your Outreach with ProspectFlow
            </h1>
            <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-8">
              Stop juggling spreadsheets and scattered notes. ProspectFlow helps you manage job applications, sales leads, and professional networking like a pro.
            </p>
            <Button size="lg" className="text-lg px-8 py-6 shadow-xl" asChild>
              <Link href="/auth?action=signup">Get Started for Free</Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-4">No credit card required for Free Tier.</p>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-secondary/50">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 font-headline text-foreground">Why Choose ProspectFlow?</h2>
            <p className="text-center text-muted-foreground mb-12 md:mb-16 max-w-2xl mx-auto">
                Focus on what matters: building connections and landing opportunities. We'll handle the organization.
            </p>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="text-center shadow-lg hover:shadow-xl transition-shadow bg-card">
                  <CardHeader className="items-center">
                    {feature.icon}
                    <CardTitle className="font-headline">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        
        {/* How it Works Section (Simplified) */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 font-headline text-foreground">Simple Steps to Success</h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground rounded-full h-12 w-12 flex items-center justify-center text-xl font-bold mb-4 shadow-md">1</div>
                <h3 className="text-xl font-semibold mb-2 font-headline">Add Prospects</h3>
                <p className="text-sm text-muted-foreground">Quickly add companies, contacts, and job openings.</p>
                 <Image src="https://placehold.co/600x400.png" alt="Add Prospects illustration" data-ai-hint="data entry form" width={600} height={400} className="mt-4 rounded-lg shadow-md aspect-video object-cover" />
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground rounded-full h-12 w-12 flex items-center justify-center text-xl font-bold mb-4 shadow-md">2</div>
                <h3 className="text-xl font-semibold mb-2 font-headline">Track Progress</h3>
                <p className="text-sm text-muted-foreground">Update statuses and log your interactions easily.</p>
                 <Image src="https://placehold.co/600x400.png" alt="Track Progress illustration" data-ai-hint="dashboard progress" width={600} height={400} className="mt-4 rounded-lg shadow-md aspect-video object-cover" />
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-primary text-primary-foreground rounded-full h-12 w-12 flex items-center justify-center text-xl font-bold mb-4 shadow-md">3</div>
                <h3 className="text-xl font-semibold mb-2 font-headline">Follow Up Smartly</h3>
                <p className="text-sm text-muted-foreground">Get reminders and use templates for consistent outreach.</p>
                 <Image src="https://placehold.co/600x400.png" alt="Follow Up illustration" data-ai-hint="calendar reminder" width={600} height={400} className="mt-4 rounded-lg shadow-md aspect-video object-cover" />
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 md:py-24 bg-secondary/50">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 font-headline text-foreground">Loved by Professionals</h2>
            <div className="grid gap-8 md:grid-cols-2">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.name} className="shadow-lg bg-card">
                  <CardContent className="pt-6">
                    <blockquote className="text-lg italic text-foreground mb-4">"{testimonial.quote}"</blockquote>
                    <div className="flex items-center">
                      <Image data-ai-hint={testimonial.dataAiHint} src={testimonial.avatar} alt={testimonial.name} width={48} height={48} className="rounded-full mr-4" />
                      <div>
                        <p className="font-semibold">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32 text-center bg-background">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 font-headline text-foreground">
              Ready to Streamline Your Outreach?
            </h2>
            <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-8">
              Join ProspectFlow today and take control of your professional opportunities.
            </p>
            <Button size="lg" className="text-lg px-8 py-6 shadow-xl" asChild>
              <Link href="/auth?action=signup">Sign Up - It's Free to Start</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t bg-background">
        <div className="container px-4 md:px-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ProspectFlow. All rights reserved.</p>
          {/* <p className="mt-1">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link> | <Link href="/terms" className="hover:underline">Terms of Service</Link>
          </p> */}
        </div>
      </footer>
    </div>
  );
}
