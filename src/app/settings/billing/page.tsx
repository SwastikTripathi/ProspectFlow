
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Circle, Loader2, CreditCard, HelpCircle, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import type { UserSubscription, AvailablePlan, SubscriptionTier, SubscriptionStatus } from '@/lib/types'; // Removed UsagePreference
import { createRazorpayOrder, verifyRazorpayPayment } from '@/app/actions/razorpayActions';
import { add } from 'date-fns';

const NEXT_PUBLIC_RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

const ALL_AVAILABLE_PLANS: AvailablePlan[] = [
  {
    id: 'free',
    name: 'Free Tier',
    priceMonthly: 0,
    description: 'Get started with core features for free.',
    features: [
      { text: 'Track up to 30 job openings', included: true },
      { text: 'Manage up to 25 contacts', included: true },
      { text: 'Store up to 25 companies', included: true },
      { text: 'Basic email templates', included: true },
      { text: 'Community support', included: false },
    ],
    cta: 'Current Plan',
    isPopular: false,
  },
  {
    id: 'basic',
    name: 'Basic Plan',
    priceMonthly: 40, // INR - Updated Price
    description: 'Unlock more features for serious prospecting.',
    features: [
      { text: 'Track up to 100 job openings', included: true },
      { text: 'Manage up to 75 contacts', included: true },
      { text: 'Store up to 75 companies', included: true },
      { text: 'Advanced contact management & tagging', included: true },
      { text: 'Custom follow-up cadence', included: true },
      { text: 'Unlimited saved email templates', included: true },
      { text: 'Email support', included: true },
    ],
    cta: 'Choose Basic',
    isPopular: true,
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    priceMonthly: 100, // INR - Updated Price
    description: 'For power users and teams needing the best.',
    features: [
      { text: 'Track up to 150 job openings', included: true },
      { text: 'Manage up to 100 contacts', included: true },
      { text: 'Store up to 100 companies', included: true },
      { text: 'Advanced contact management & tagging', included: true },
      { text: 'Custom follow-up cadence', included: true },
      { text: 'Unlimited saved email templates', included: true },
      { text: 'AI-powered email suggestions (Coming Soon)', included: true },
      { text: 'Priority support', included: true },
      { text: 'Team features (Coming Soon)', included: true },
    ],
    cta: 'Go Premium',
  },
];

export default function BillingPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null); // To track which plan is being processed

  const { toast } = useToast();

  useEffect(() => {
    if (!NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        console.warn("BillingPage: NEXT_PUBLIC_RAZORPAY_KEY_ID is not set. Ensure it's configured in .env.local for payments to work.");
        toast({
            title: "Razorpay Misconfiguration",
            description: "Razorpay Key ID is not properly set up. Payments may not function.",
            variant: "destructive",
            duration: 10000,
        });
    }
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setCurrentUser(session?.user ?? null);
        if (!session?.user) {
          setCurrentSubscription(null);
          setIsLoading(false);
        }
      }
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if(!user) setIsLoading(false);
    });
    return () => authListener.subscription?.unsubscribe();
  }, [toast]);

  const fetchSubscription = useCallback(async () => {
    if (!currentUser) {
      setCurrentSubscription(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') { 
        throw error;
      }
      if (data) {
        setCurrentSubscription({
          ...data,
          plan_start_date: data.plan_start_date ? new Date(data.plan_start_date) : null,
          plan_expiry_date: data.plan_expiry_date ? new Date(data.plan_expiry_date) : null,
        } as UserSubscription);
      } else {
        setCurrentSubscription(null);
      }
    } catch (error: any) {
      toast({ title: 'Error Fetching Subscription', description: error.message, variant: 'destructive' });
      setCurrentSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser) {
        fetchSubscription();
    } else {
        setIsLoading(false);
        setCurrentSubscription(null);
    }
  }, [currentUser, fetchSubscription]);

  const handleSelectPlan = async (plan: AvailablePlan) => {
    if (!currentUser) {
      toast({ title: 'Not Logged In', description: 'Please log in to select a plan.', variant: 'destructive'});
      return;
    }
    if (plan.id === currentSubscription?.tier && currentSubscription?.status === 'active') {
      toast({ title: 'Already Subscribed', description: `You are already on the ${plan.name}.`, variant: 'default' });
      return;
    }
    
    setProcessingPlanId(plan.id);
    setIsProcessingPayment(true);

    try {
      const startDate = new Date();
      const expiryDate = add(startDate, { days: 30 }); // Assuming 30-day subscription for simplicity

      if (plan.priceMonthly === 0 || plan.id === 'free') {
        // Upsert for free plan, no usage_preference here
        const { error: upsertError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: currentUser.id,
            tier: plan.id as SubscriptionTier,
            plan_start_date: startDate.toISOString(),
            plan_expiry_date: expiryDate.toISOString(),
            status: 'active' as SubscriptionStatus,
            // usage_preference: null, // Removed
          }, { onConflict: 'user_id' });

        if (upsertError) throw upsertError;
        toast({ title: 'Plan Activated!', description: `You are now on the ${plan.name}.` });
        await fetchSubscription();
      } else {
        // Paid plan flow
        if (!NEXT_PUBLIC_RAZORPAY_KEY_ID) {
            throw new Error("Razorpay Key ID is not configured. Payment cannot proceed.");
        }
        const orderPayload = {
          amount: plan.priceMonthly * 100, 
          currency: 'INR',
          receipt: `pf_${plan.id}_${Date.now()}`,
          notes: {
            planId: plan.id,
            userId: currentUser.id,
            userName: currentUser.user_metadata?.full_name || currentUser.email || 'User',
            userEmail: currentUser.email || 'N/A'
          }
        };
        const orderData = await createRazorpayOrder(orderPayload);
        
        if (!orderData || orderData.error || !orderData.order_id) {
          throw new Error(orderData?.error || 'Failed to create Razorpay order.');
        }
        
        const options = {
          key: NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "ProspectFlow",
          description: `${plan.name} Subscription`,
          order_id: orderData.order_id,
          handler: async function (response: any) {
            setProcessingPlanId(plan.id); // Ensure this is set before async handler
            setIsProcessingPayment(true); 
            const verificationResult = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verificationResult.success) {
               const { error: upsertError } = await supabase
                .from('user_subscriptions')
                .upsert({
                  user_id: currentUser.id,
                  tier: plan.id as SubscriptionTier,
                  plan_start_date: startDate.toISOString(),
                  plan_expiry_date: expiryDate.toISOString(),
                  status: 'active' as SubscriptionStatus,
                  // usage_preference: null, // Removed
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                }, { onConflict: 'user_id' });

              if (upsertError) throw upsertError;
              toast({ title: 'Payment Successful!', description: `You are now subscribed to ${plan.name}.`});
              await fetchSubscription();
            } else {
              toast({ title: 'Payment Verification Failed', description: verificationResult.error || 'Please contact support.', variant: 'destructive' });
            }
            setIsProcessingPayment(false);
            setProcessingPlanId(null);
          },
          prefill: {
            name: currentUser.user_metadata?.full_name || currentUser.email,
            email: currentUser.email,
          },
          theme: {
            color: "#673AB7" 
          },
          modal: {
            ondismiss: function() {
              setIsProcessingPayment(false);
              setProcessingPlanId(null);
            }
          }
        };
        // @ts-ignore
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any){
            toast({
                title: 'Payment Failed',
                description: `Code: ${response.error.code}, Reason: ${response.error.description || response.error.reason}`,
                variant: 'destructive'
            });
            setIsProcessingPayment(false);
            setProcessingPlanId(null);
        });
        rzp.open();
        // setIsProcessingPayment(false) is handled by Razorpay callbacks now for paid plans
        // setProcessingPlanId(null) is handled by Razorpay callbacks now
        return; // Prevent setIsProcessingPayment(false) at the end of function for Razorpay flow
      }
    } catch (error: any) {
      toast({ title: 'Error Processing Plan', description: error.message || 'Could not process your request.', variant: 'destructive' });
    } 
    setIsProcessingPayment(false);
    setProcessingPlanId(null);
  };
  
  const displayedPlans = ALL_AVAILABLE_PLANS.map(plan => ({
    ...plan,
    isCurrent: currentSubscription?.tier === plan.id && currentSubscription?.status === 'active',
    disabled: isProcessingPayment || (currentSubscription?.tier === plan.id && currentSubscription?.status === 'active'),
    cta: (currentSubscription?.tier === plan.id && currentSubscription?.status === 'active') ? 'Current Plan' : (plan.id === 'free' ? 'Choose Free' : `Get ${plan.name}`)
  }));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline flex items-center">
            <CreditCard className="mr-3 h-7 w-7 text-primary" />
            Billing & Plan
          </h2>
          <p className="text-muted-foreground">Manage your subscription and billing details.</p>
        </div>

        {currentSubscription && (
          <Card className="shadow-lg border-primary border-2">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Your Current Plan: {ALL_AVAILABLE_PLANS.find(p=>p.id === currentSubscription.tier)?.name || currentSubscription.tier}</CardTitle>
              <CardDescription>
                Status: <span className={`font-semibold ${currentSubscription.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentSubscription.plan_start_date && (
                <p>Started on: {new Date(currentSubscription.plan_start_date).toLocaleDateString()}</p>
              )}
              {currentSubscription.plan_expiry_date && currentSubscription.status === 'active' && (
                <p>Renews/Expires on: {new Date(currentSubscription.plan_expiry_date).toLocaleDateString()}</p>
              )}
               {currentSubscription.razorpay_order_id && (
                <p className="text-xs text-muted-foreground">Order ID: {currentSubscription.razorpay_order_id}</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {displayedPlans.map((plan) => (
            <Card key={plan.id} className={`flex flex-col shadow-xl hover:shadow-2xl transition-shadow duration-300 ${plan.isCurrent ? 'border-accent border-2' : ''} ${plan.isPopular ? 'border-primary border-2' : ''}`}>
              {plan.isPopular && !plan.isCurrent && (
                <div className="bg-primary text-primary-foreground text-xs font-semibold py-1 px-3 rounded-t-md text-center">
                  Most Popular
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="font-headline text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                <div className="text-4xl font-bold">
                  ₹{plan.priceMonthly}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature, index) => (
                    <li key={index} className={`flex items-center ${feature.included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                      {feature.included ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Circle className="mr-2 h-4 w-4 text-muted-foreground" />}
                      {feature.text}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan(plan)}
                  disabled={plan.disabled || (isProcessingPayment && processingPlanId === plan.id)}
                  variant={plan.isCurrent ? 'outline' : (plan.isPopular ? 'default' : 'secondary')}
                >
                  {isProcessingPayment && processingPlanId === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
         <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="font-headline flex items-center"><HelpCircle className="mr-2 h-5 w-5 text-primary"/>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>How do I cancel my subscription?</strong> Currently, plan cancellation is not self-serve. Please contact support for assistance.</p>
                <p><strong>What happens when my plan expires?</strong> If auto-renewal is not set up (not currently implemented), your plan will revert to Free, or access may be restricted. You'll be prompted to renew.</p>
                <p><strong>Can I upgrade or downgrade my plan?</strong> Yes, you can choose a new plan. Prorated charges or credits are not implemented in this prototype.</p>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
