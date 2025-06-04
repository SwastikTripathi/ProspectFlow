
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
import type { UserSubscription, AvailablePlan, SubscriptionTier, SubscriptionStatus } from '@/lib/types';
import { createRazorpayOrder, verifyRazorpayPayment } from '@/app/actions/razorpayActions';
import { addMonths, isFuture } from 'date-fns';
import { ALL_AVAILABLE_PLANS } from '@/lib/config'; // Import from config
import { cn } from '@/lib/utils';

const NEXT_PUBLIC_RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

export default function BillingPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<SubscriptionTier | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (!NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        console.warn("BillingPage: NEXT_PUBLIC_RAZORPAY_KEY_ID is not set.");
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
          tier: data.tier as SubscriptionTier,
          status: data.status as SubscriptionStatus,
          plan_start_date: data.plan_start_date ? new Date(data.plan_start_date) : null,
          plan_expiry_date: data.plan_expiry_date ? new Date(data.plan_expiry_date) : null,
        });
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
    if (plan.id === currentSubscription?.tier && currentSubscription?.status === 'active' && plan.id === 'free') {
      toast({ title: 'Already on Free Plan', description: `You are already on the ${plan.name}.`, variant: 'default' });
      return;
    }
     if (plan.id === currentSubscription?.tier && plan.id !== 'free') {
      toast({ title: 'Extend Plan?', description: `You are already on ${plan.name}. To extend, proceed with payment.`, variant: 'default' });
      // Allow proceeding to extend for paid plans
    }
    
    setProcessingPlanId(plan.id);
    setIsProcessingPayment(true);

    try {
      let newStartDate = new Date();
      let newExpiryDate;

      if (currentSubscription && currentSubscription.status === 'active' && currentSubscription.tier.startsWith('premium') && currentSubscription.plan_expiry_date && isFuture(new Date(currentSubscription.plan_expiry_date))) {
        // Extend existing active premium subscription
        newStartDate = new Date(currentSubscription.plan_start_date!); 
        newExpiryDate = addMonths(new Date(currentSubscription.plan_expiry_date), plan.durationMonths);
      } else {
        // New subscription or renewal of expired/free plan
        newExpiryDate = addMonths(newStartDate, plan.durationMonths);
      }


      if (plan.priceMonthly === 0 || plan.id === 'free') {
        const { error: upsertError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: currentUser.id,
            tier: plan.id,
            plan_start_date: new Date().toISOString(), 
            plan_expiry_date: addMonths(new Date(), plan.durationMonths).toISOString(), 
            status: 'active' as SubscriptionStatus,
          }, { onConflict: 'user_id' });

        if (upsertError) throw upsertError;
        toast({ title: 'Plan Activated!', description: `You are now on the ${plan.name}.` });
        await fetchSubscription();
      } else {
        if (!NEXT_PUBLIC_RAZORPAY_KEY_ID) {
            throw new Error("Razorpay Key ID is not configured. Payment cannot proceed.");
        }
        
        const baseTotalAmount = plan.priceMonthly * plan.durationMonths;
        const discount = plan.discountPercentage ? baseTotalAmount * (plan.discountPercentage / 100) : 0;
        const finalAmount = baseTotalAmount - discount;

        const orderPayload = {
          amount: Math.round(finalAmount * 100), // Amount in paisa
          currency: 'INR',
          receipt: `pf_${plan.id}_${Date.now()}`,
          notes: {
            planId: plan.id,
            userId: currentUser.id,
            userName: currentUser.user_metadata?.full_name || currentUser.email || 'User',
            userEmail: currentUser.email || 'N/A',
            durationMonths: plan.durationMonths
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
          description: `${plan.name} - ${plan.durationMonths} Month(s)`,
          order_id: orderData.order_id,
          handler: async function (response: any) {
            setProcessingPlanId(plan.id); 
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
                  user_id: currentUser!.id, 
                  tier: plan.id,
                  plan_start_date: newStartDate.toISOString(), 
                  plan_expiry_date: newExpiryDate.toISOString(),
                  status: 'active' as SubscriptionStatus,
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
        return; 
      }
    } catch (error: any) {
      toast({ title: 'Error Processing Plan', description: error.message || 'Could not process your request.', variant: 'destructive' });
    } 
    setIsProcessingPayment(false);
    setProcessingPlanId(null);
  };
  
  const displayedPlans = ALL_AVAILABLE_PLANS.map(plan => {
    const isCurrentActivePlan = currentSubscription?.tier === plan.id && currentSubscription?.status === 'active';
    let ctaText = plan.cta;
    if (isCurrentActivePlan) {
        ctaText = plan.id === 'free' ? 'Current Plan' : 'Extend Plan';
    } else if (plan.id === 'free') {
        ctaText = 'Switch to Free';
    } else {
        ctaText = `Get ${plan.name}`;
    }
    
    return {
      ...plan,
      isCurrent: isCurrentActivePlan,
      disabled: isProcessingPayment || (isCurrentActivePlan && plan.id === 'free'), 
      cta: ctaText,
    };
  });

  const calculatePlanDisplayPrice = (plan: AvailablePlan) => {
    if (plan.priceMonthly === 0) return { main: "Free", sub: "" };
    
    const totalBeforeDiscount = plan.priceMonthly * plan.durationMonths;
    const discountAmount = plan.discountPercentage ? totalBeforeDiscount * (plan.discountPercentage / 100) : 0;
    const finalPrice = totalBeforeDiscount - discountAmount;

    let mainPrice = `₹${Math.round(finalPrice)}`;
    let subText = `for ${plan.durationMonths} month${plan.durationMonths > 1 ? 's' : ''}`;
    if (plan.discountPercentage) {
      subText += ` (Save ${plan.discountPercentage}%)`;
    }
    return { main: mainPrice, sub: subText };
  };


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
                <p>Valid From: {new Date(currentSubscription.plan_start_date).toLocaleDateString()}</p>
              )}
              {currentSubscription.plan_expiry_date && currentSubscription.status === 'active' && (
                <p>Valid Until: {new Date(currentSubscription.plan_expiry_date).toLocaleDateString()}</p>
              )}
               {currentSubscription.razorpay_order_id && (
                <p className="text-xs text-muted-foreground">Last Order ID: {currentSubscription.razorpay_order_id}</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {displayedPlans.map((plan) => {
            const displayPrice = calculatePlanDisplayPrice(plan);
            return (
            <Card key={plan.id} className={cn("flex flex-col shadow-xl hover:shadow-2xl transition-shadow duration-300 relative", plan.isCurrent ? 'border-accent border-2' : '', plan.isPopular ? 'border-primary border-2' : '')}>
              {plan.isPopular && !plan.isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold py-1 px-3 rounded-full shadow-md">
                  Most Popular
                </div>
              )}
              <CardHeader className={cn("pb-4", plan.isPopular && !plan.isCurrent && "pt-7")}>
                <CardTitle className="font-headline text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                <div className="text-4xl font-bold">
                  {displayPrice.main}
                </div>
                 <p className="text-xs text-muted-foreground">{displayPrice.sub}</p>
                {plan.priceMonthly > 0 && plan.durationMonths > 1 && plan.discountPercentage && (
                  <p className="text-sm font-semibold text-green-600">
                    Originally ₹{plan.priceMonthly * plan.durationMonths}, save {plan.discountPercentage}%!
                  </p>
                )}
                 {plan.priceMonthly > 0 && plan.durationMonths > 1 && !plan.discountPercentage && (
                   <p className="text-sm text-muted-foreground">
                    (₹{plan.priceMonthly}/month)
                  </p>
                 )}


                <ul className="space-y-2 text-sm pt-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className={`flex items-center ${feature.included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                      {feature.included ? <CheckCircle className="mr-2 h-4 w-4 text-green-500 flex-shrink-0" /> : <Circle className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />}
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
                  variant={plan.isCurrent && plan.id !== 'free' ? 'default' : (plan.isCurrent ? 'outline' : (plan.isPopular ? 'default' : 'secondary'))}
                >
                  {isProcessingPayment && processingPlanId === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
        </div>
         <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="font-headline flex items-center"><HelpCircle className="mr-2 h-5 w-5 text-primary"/>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p><strong>How do I cancel my subscription?</strong> Currently, plan cancellation is not self-serve. Please contact support for assistance.</p>
                <p><strong>What happens when my plan expires?</strong> If auto-renewal is not set up (not currently implemented), your plan will revert to Free, or access may be restricted. You'll be prompted to renew.</p>
                 <p><strong>Can I upgrade or downgrade my plan?</strong> Yes, choosing a new plan will set its own validity period. Extensions apply if you re-purchase or choose a different premium plan while one is active.</p>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

