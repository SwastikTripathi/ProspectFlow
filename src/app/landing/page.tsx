
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, TrendingUp, Users, Target, Briefcase, Zap, ArrowRight, Eye, MailCheck, Building } from 'lucide-react';
import { Logo } from '@/components/icons/Logo';
import { Badge } from '@/components/ui/badge';

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
    avatar: 'https://placehold.co/100x100.png', // Main testimonial avatar
    dataAiHint: 'person portrait'
  },
  {
    quote: "As a sales professional, keeping track of leads and follow-ups is crucial. ProspectFlow makes it effortless.",
    name: 'Sarah K.',
    role: 'Sales Manager',
    avatar: 'https://placehold.co/100x100.png', // Main testimonial avatar
    dataAiHint: 'professional woman'
  },
];

function HeroVisual() {
  const mockCardsData = [
    {
      type: 'JOB OPENING',
      title: 'Software Engineer',
      company: 'Innovate Inc.',
      status: 'Applied',
      statusColor: 'bg-blue-500 text-blue-50',
      avatar: 'https://placehold.co/32x32.png',
      dataAiHint: 'office building',
      icon: <Briefcase className="h-4 w-4 text-muted-foreground" />
    },
    {
      type: 'CONTACT',
      title: 'Alex Chen',
      company: 'Hiring Manager @ Innovate Inc.',
      status: 'Emailed',
      statusColor: 'bg-green-500 text-green-50',
      avatar: 'https://placehold.co/32x32.png',
      dataAiHint: 'person professional',
      icon: <Users className="h-4 w-4 text-muted-foreground" />
    },
    {
      type: 'REMINDER',
      title: 'Follow up: Sarah K.',
      company: 'Product Designer Role',
      status: 'Due Today',
      statusColor: 'bg-yellow-500 text-yellow-50',
      avatar: 'https://placehold.co/32x32.png',
      dataAiHint: 'calendar alert',
      icon: <MailCheck className="h-4 w-4 text-muted-foreground" />
    },
    {
      type: 'COMPANY',
      title: 'Tech Solutions Ltd.',
      company: 'Next step: Initial Outreach',
      status: 'Watching',
      statusColor: 'bg-purple-500 text-purple-50',
      avatar: 'https://placehold.co/32x32.png',
      dataAiHint: 'modern building',
      icon: <Building className="h-4 w-4 text-muted-foreground" />
    },
  ];

  return (
    <div className="mt-12 lg:mt-20">
      <div className="relative max-w-5xl mx-auto p-1 bg-card rounded-xl shadow-2xl border border-border/20 overflow-hidden">
        <div className="p-4 sm:p-5 lg:p-6 bg-background rounded-[0.6rem]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {mockCardsData.map((card, index) => (
              <div key={index} className="bg-card p-3 rounded-lg shadow-md border border-border/50 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className={`text-xs ${card.statusColor} border-transparent`}>{card.status}</Badge>
                  {card.icon}
                </div>
                <div className="flex items-center mb-1.5">
                   <Image 
                    src={card.avatar} 
                    alt={card.title} 
                    width={28} 
                    height={28} 
                    className="rounded-full mr-2 border border-border/20" 
                    data-ai-hint={card.dataAiHint}
                  />
                  <h4 className="text-sm font-semibold text-card-foreground truncate leading-tight">{card.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground truncate">{card.company}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/10">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-6">
          <Link href="/landing" className="mr-6 flex items-center space-x-2">
            <Logo />
          </Link>
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <Button variant="ghost" asChild className="rounded-full">
              <Link href="#">Pricing</Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full">
              <Link href="#">Blog</Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full">
              <Link href="#">About</Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full">
              <Link href="/auth">Sign In</Link>
            </Button>
            <Button asChild className="shadow-md rounded-full">
              <Link href="/auth?action=signup">Try for Free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-28 text-center bg-background">
          <div className="container px-4 md:px-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter mb-6 font-headline text-foreground">
              Stop losing leads and<br className="hidden sm:inline" /> missing <span className="text-primary">follow-ups</span>.
            </h1>
            <p className="max-w-2xl mx-auto text-md sm:text-lg md:text-xl text-muted-foreground mb-8">
              ProspectFlow is the easy-to-use tool built to streamline your outreach: manage job applications, sales leads, and professional networking like a pro.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6">
                <Button size="lg" className="text-lg px-8 py-6 shadow-xl w-full sm:w-auto rounded-full" asChild>
                <Link href="/auth?action=signup">Get Started for Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="link" 
                  className="text-lg px-8 py-6 w-full sm:w-auto rounded-full text-muted-foreground underline underline-offset-4 hover:text-primary/90 hover:decoration-primary/90" 
                  asChild
                >
                  <Link href="#features">Explore Features</Link>
                </Button>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center"><CheckCircle className="h-4 w-4 mr-1.5 text-green-500"/>Free Tier available</span>
                <span className="flex items-center"><CheckCircle className="h-4 w-4 mr-1.5 text-green-500"/>No credit card required to start</span>
                <span className="flex items-center"><CheckCircle className="h-4 w-4 mr-1.5 text-green-500"/>Automated Follow-up Reminders</span>
            </div>
            <HeroVisual />
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
                  <CardHeader className="items-center pb-4">
                    {React.cloneElement(feature.icon, { className: "h-8 w-8 text-primary mb-3" })}
                    <CardTitle className="font-headline text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* New Inspired Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container px-4 md:px-6">
            <div className="text-left md:text-center max-w-3xl mx-auto mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-headline text-foreground mb-2">
                Why Professionals Streamline with ProspectFlow
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground">
                Focus on connections, not on <span className="text-primary font-semibold">clutter</span>.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="space-y-6">
                <h3 className="text-2xl font-semibold font-headline text-foreground">Built for Efficiency and Action</h3>
                <p className="text-muted-foreground leading-relaxed">
                  ProspectFlow cuts through the noise, helping your team manage outreach faster and more effectively. More targeted connections lead to more opportunities. Designed for daily use, ProspectFlow makes tracking simple, so you can focus on building relationships, not fighting your tools. Get started in minutes, not months.
                </p>
                <div className="border-l-4 border-primary pl-6 py-4 bg-secondary/30 rounded-r-lg">
                  <blockquote className="text-muted-foreground italic mb-4">
                    "{testimonials[0].quote}"
                  </blockquote>
                  <div className="flex items-center">
                    <Image 
                      data-ai-hint="person portrait" 
                      src="https://placehold.co/40x40.png" 
                      alt={testimonials[0].name} 
                      width={40} 
                      height={40} 
                      className="rounded-full mr-3" 
                    />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{testimonials[0].name}</p>
                      <p className="text-xs text-muted-foreground">{testimonials[0].role}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="relative aspect-[4/3] lg:aspect-[5/4] rounded-xl shadow-2xl overflow-hidden border border-border/20">
                  <Image 
                    src="https://placehold.co/600x450.png" 
                    alt="ProspectFlow App Dashboard Mockup" 
                    layout="fill"
                    objectFit="cover"
                    className="bg-muted"
                    data-ai-hint="app dashboard" 
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section className="py-16 md:py-24 bg-secondary/50">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 font-headline text-foreground">Loved by Professionals</h2>
            <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
              {testimonials.map((testimonial, index) => ( // Use index for key if names are not unique
                <Card key={testimonial.name + index} className="shadow-lg bg-card">
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
        <section className="py-20 md:py-28 text-center bg-background">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 font-headline text-foreground">
              Ready to Streamline Your Outreach?
            </h2>
            <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-8">
              Join ProspectFlow today and take control of your professional opportunities.
            </p>
            <Button size="lg" className="text-lg px-8 py-6 shadow-xl rounded-full" asChild>
              <Link href="/auth?action=signup">Sign Up - It's Free to Start</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t bg-background">
        <div className="container px-4 md:px-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ProspectFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
