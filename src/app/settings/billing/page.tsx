
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, type ButtonProps } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Circle, Loader2, CreditCard, HelpCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import type { UserSubscription, AvailablePlan, SubscriptionTier, SubscriptionStatus } from '@/lib/types';
import { createRazorpayOrder, verifyRazorpayPayment } from '@/app/actions/razorpayActions';
import { addMonths, isFuture, format } from 'date-fns';
import { ALL_AVAILABLE_PLANS } from '@/lib/config';
import { cn } from '@/lib/utils';

const NEXT_PUBLIC_RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

interface PlanDisplayInfo {
  isFree: boolean;
  isDiscounted: boolean;
  originalTotalPrice?: number;
  discountedPricePerMonth?: number;
  finalTotalPrice: number;
  priceMonthlyDirect?: number;
  durationMonths: number;
  discountPercentage?: number;
}


export default function BillingPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

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
        // No active subscription, default to free effectively by setting null
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

  const calculatePlanDisplayInfo = (plan: AvailablePlan): PlanDisplayInfo => {
    // The 'databaseTier' is 'free' or 'premium'. 'id' is for the purchase option.
    if (plan.databaseTier === 'free') {
      return {
        isFree: true,
        isDiscounted: false,
        finalTotalPrice: 0,
        durationMonths: plan.durationMonths,
      };
    }
  
    // Paid plans (databaseTier === 'premium')
    const originalTotal = plan.priceMonthly * plan.durationMonths;
    let finalTotal = originalTotal;
    let discountedPerMonth;
  
    if (plan.discountPercentage && plan.discountPercentage > 0) {
      const discountAmount = originalTotal * (plan.discountPercentage / 100);
      finalTotal = originalTotal - discountAmount;
      discountedPerMonth = Math.round(finalTotal / plan.durationMonths); 
      return {
        isFree: false,
        isDiscounted: true,
        originalTotalPrice: Math.round(originalTotal),
        discountedPricePerMonth: discountedPerMonth,
        finalTotalPrice: Math.round(finalTotal),
        durationMonths: plan.durationMonths,
        discountPercentage: plan.discountPercentage,
      };
    } else {
      // No discount on this specific premium purchase option
      return {
        isFree: false,
        isDiscounted: false,
        priceMonthlyDirect: plan.priceMonthly, 
        finalTotalPrice: Math.round(originalTotal), 
        durationMonths: plan.durationMonths,
      };
    }
  };

  const handleSelectPlan = async (plan: AvailablePlan) => {
    if (!currentUser) {
      toast({ title: 'Not Logged In', description: 'Please log in to select a plan.', variant: 'destructive'});
      return;
    }
    
    // Check if user is already on the DB tier this plan maps to.
    // For example, if plan.databaseTier is 'premium' and currentSubscription.tier is 'premium'
    const isAlreadyEffectivelyOnThisDbTier = currentSubscription?.tier === plan.databaseTier && currentSubscription?.status === 'active';

    if (plan.databaseTier === 'premium' && isAlreadyEffectivelyOnThisDbTier) {
      // User is already on a premium plan, so this is an extension or change of duration
    } else if (plan.databaseTier === 'free' && isAlreadyEffectivelyOnThisDbTier) {
      toast({ title: 'Plan Active', description: `You are already on the ${plan.name}.`, variant: 'default' });
      return;
    }


    setProcessingPlanId(plan.id); // Use plan.id (purchase option ID) for tracking
    setIsProcessingPayment(true);

    try {
      let newStartDate: Date;
      let newExpiryDate: Date;

      const isUserCurrentlyOnActivePremium = 
        currentSubscription &&
        currentSubscription.tier === 'premium' && // Checks DB tier
        currentSubscription.status === 'active' &&
        currentSubscription.plan_expiry_date &&
        isFuture(new Date(currentSubscription.plan_expiry_date));

      if (plan.databaseTier === 'premium' && isUserCurrentlyOnActivePremium) {
        // Extending an existing premium subscription
        newStartDate = new Date(currentSubscription!.plan_start_date!); 
        newExpiryDate = addMonths(new Date(currentSubscription!.plan_expiry_date!), plan.durationMonths);
      } else {
        // New subscription (was free, or expired premium, or first time)
        newStartDate = new Date();
        newExpiryDate = addMonths(newStartDate, plan.durationMonths);
      }

      if (plan.databaseTier === 'free') {
        const { error: upsertError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: currentUser.id,
            tier: 'free', // Always store 'free' for this plan.databaseTier
            plan_start_date: newStartDate.toISOString(), 
            plan_expiry_date: newExpiryDate.toISOString(), // Free plans also get an expiry, e.g. 99 years
            status: 'active' as SubscriptionStatus,
            razorpay_order_id: null,
            razorpay_payment_id: null,
          }, { onConflict: 'user_id' });

        if (upsertError) throw new Error(upsertError.message || 'Failed to activate free plan.');
        toast({ title: 'Plan Activated!', description: `You are now on the ${plan.name}.` });
        await fetchSubscription();
      } else { 
        // Paid plan logic (all map to 'premium' DB tier)
        if (!NEXT_PUBLIC_RAZORPAY_KEY_ID) {
            throw new Error("Razorpay Key ID is not configured. Payment cannot proceed.");
        }
        
        const priceInfo = calculatePlanDisplayInfo(plan);
        const finalAmountForPayment = priceInfo.finalTotalPrice;

        const orderPayload = {
          amount: Math.round(finalAmountForPayment * 100), 
          currency: 'INR',
          receipt: `pf_${plan.id}_${Date.now()}`,
          notes: {
            purchaseOptionId: plan.id, // e.g., 'premium-1m', 'premium-6m'
            mapsToDbTier: plan.databaseTier, // Should be 'premium'
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
          description: `${plan.name}`, // e.g. "Premium - 6 Months"
          order_id: orderData.order_id,
          handler: async function (response: any) {
            setProcessingPlanId(plan.id); 
            setIsProcessingPayment(true); 
            try { 
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
                    tier: 'premium', // All paid plans map to 'premium' tier in DB
                    plan_start_date: newStartDate.toISOString(), 
                    plan_expiry_date: newExpiryDate.toISOString(),
                    status: 'active' as SubscriptionStatus,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                  }, { onConflict: 'user_id' });

                 if (upsertError) throw new Error(upsertError.message || 'Failed to update subscription after payment.');
                toast({ title: 'Payment Successful!', description: `Your subscription to ${plan.name} is active.`});
                await fetchSubscription();
              } else {
                toast({ title: 'Payment Verification Failed', description: verificationResult.error || 'Please contact support.', variant: 'destructive' });
              }
            } catch (handlerError: any) {
               toast({ title: 'Error Updating Subscription', description: handlerError.message || 'Could not update your subscription after payment.', variant: 'destructive' });
            } finally {
                setIsProcessingPayment(false);
                setProcessingPlanId(null);
            }
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
  
  const displayedPlans = ALL_AVAILABLE_PLANS.map((plan) => {
    const priceInfo = calculatePlanDisplayInfo(plan);
    const isCurrentlySelectedProcessing = processingPlanId === plan.id && isProcessingPayment;

    // Is the user currently on *any* active premium plan?
    const isUserOnActivePremium = 
        currentSubscription &&
        currentSubscription.tier === 'premium' && // Check against the DB tier 'premium'
        currentSubscription.status === 'active' &&
        currentSubscription.plan_expiry_date &&
        isFuture(new Date(currentSubscription.plan_expiry_date));

    // Does this specific card's databaseTier match the user's active database tier?
    const isCardRepresentingCurrentActiveDbTier = currentSubscription?.tier === plan.databaseTier && currentSubscription?.status === 'active';


    let ctaTextParts: React.ReactNode[] = [];
    let finalButtonIsDisabled = isCurrentlySelectedProcessing;
    let finalButtonVariant: ButtonProps['variant'] = (plan.isPopular && plan.databaseTier === 'premium') ? 'default' : 'secondary';


    if (plan.databaseTier === 'free') {
        if (isUserOnActivePremium) { // User is on active Premium, so "Free" button should be disabled
            ctaTextParts.push(<span key="text" className="font-bold">Premium Active</span>);
            finalButtonIsDisabled = true;
            finalButtonVariant = 'outline';
        } else if (isCardRepresentingCurrentActiveDbTier) { // User is on active Free plan
            ctaTextParts.push(<span key="text" className="font-bold">Current Plan</span>);
            finalButtonIsDisabled = true;
            finalButtonVariant = 'outline';
        } else { // User is not on active premium, and not on active free (e.g. expired, or never subbed)
            ctaTextParts.push(<span key="text" className="font-bold">Switch to Free</span>);
            finalButtonVariant = 'secondary';
        }
    } else { // Paid Plan (databaseTier === 'premium')
        // This specific card represents a premium purchase option.
        // The button text depends on whether the user is ALREADY on *any* active premium plan.
        if (isUserOnActivePremium) {
            ctaTextParts.push(<span key="action" className="font-bold">Extend for</span>);
        } else { // User is currently on free or has an expired/non-active sub
            ctaTextParts.push(<span key="action" className="font-bold">Buy for</span>);
        }
        
        // If this paid plan card is ALSO the one the user is currently subscribed to (unlikely with the new model, but for safety)
        if (isCardRepresentingCurrentActiveDbTier) {
             finalButtonVariant = 'outline'; // Example: Change variant if it's already active
        } else if (plan.isPopular) {
            finalButtonVariant = 'default';
        } else {
            finalButtonVariant = 'secondary';
        }
        
        if (priceInfo.isDiscounted && priceInfo.originalTotalPrice) {
           ctaTextParts.push(
                <s key="s" className="text-inherit opacity-70 ml-1.5">
                    <span className="font-normal" style={{ fontFamily: 'Arial' }}>₹</span>
                    <span className="font-bold">{priceInfo.originalTotalPrice}</span>
                </s>
            );
        }
        ctaTextParts.push(
            <span key="final" className="ml-1">
                 <span className="font-normal" style={{ fontFamily: 'Arial' }}>₹</span>
                 <span className="font-bold">{priceInfo.finalTotalPrice}</span>
            </span>
        );
    }
    
    const finalCtaButtonContent = <>{ctaTextParts}</>;

    return {
      ...plan,
      priceInfo,
      isCardRepresentingCurrentActiveDbTier: isCardRepresentingCurrentActiveDbTier,
      finalButtonIsDisabled: finalButtonIsDisabled,
      ctaButtonContent: finalCtaButtonContent,
      finalButtonVariant: finalButtonVariant,
    };
  });

  let currentPlanDisplayTitle = "N/A";
  let currentPlanStatus = "N/A";
  if (currentSubscription) {
      if (currentSubscription.tier === 'premium') {
          currentPlanDisplayTitle = "Premium"; // Simplified display name for any premium
      } else {
          currentPlanDisplayTitle = "Free Tier";
      }
      currentPlanStatus = currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1);
  } else if (!isLoading) { 
      // If no subscription record and not loading, assume Free Tier
      currentPlanDisplayTitle = "Free Tier"; 
      currentPlanStatus = "Active";
  }


  if (isLoading && !currentUser) { 
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

        {isLoading && !currentSubscription ? (
             <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-xl text-primary">Loading current plan...</CardTitle></CardHeader>
                <CardContent><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent>
             </Card>
        ): (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Your Current Plan: {currentPlanDisplayTitle}</CardTitle>
              {currentSubscription && (
                <CardDescription>
                    Status: <span className={`font-semibold ${currentSubscription.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    {currentPlanStatus}
                    </span>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {currentSubscription?.plan_start_date && (
                <p>Valid From: {format(new Date(currentSubscription.plan_start_date), 'PPP')}</p>
              )}
              {currentSubscription?.plan_expiry_date && currentSubscription?.status === 'active' && currentSubscription.tier === 'premium' && (
                <p>Valid Until: {format(new Date(currentSubscription.plan_expiry_date), 'PPP')}</p>
              )}
               {currentSubscription?.razorpay_order_id && (
                <p className="text-xs text-muted-foreground">Last Order ID: {currentSubscription.razorpay_order_id}</p>
              )}
               {!currentSubscription && !isLoading && ( 
                 <p className="text-sm text-muted-foreground">You are currently on the Free Tier.</p>
               )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {displayedPlans.map((plan) => {
            const { priceInfo } = plan;
            
            return (
            <Card key={plan.id} className={cn(
                "flex flex-col shadow-xl hover:shadow-2xl transition-shadow duration-300 relative", 
                plan.isPopular && plan.databaseTier === 'premium' ? 'border-primary border-2' : ''
            )}>
              {plan.isPopular && plan.databaseTier === 'premium' && (
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="bg-primary text-primary-foreground text-xs font-semibold py-1 px-3 rounded-full shadow-md">
                    Most Popular
                    </div>
                </div>
              )}
              <CardHeader className={cn("pb-4", plan.isPopular && plan.databaseTier === 'premium' && "pt-7")}>
                <CardTitle className="font-headline text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-1">
                <div className="text-4xl font-bold mb-1 min-h-[3rem] flex items-baseline">
                  {priceInfo.isFree ? (
                    "Free"
                  ) : priceInfo.isDiscounted && priceInfo.discountedPricePerMonth ? (
                    <div className="flex items-baseline flex-wrap gap-x-1.5">
                      <div className="flex items-baseline">
                        <span className="font-normal" style={{ fontFamily: 'Arial' }}>₹</span>
                        <span className="font-bold">{priceInfo.discountedPricePerMonth}</span>
                        <span className="text-base font-normal text-muted-foreground self-end">/mo</span>
                      </div>
                      {priceInfo.discountPercentage && (
                        <span className="text-sm font-semibold text-green-600">
                          ({priceInfo.discountPercentage}% off)
                        </span>
                      )}
                    </div>
                  ) : ( 
                    priceInfo.priceMonthlyDirect && (
                        <div className="flex items-baseline">
                        <span className="font-normal" style={{ fontFamily: 'Arial' }}>₹</span>
                        <span className="font-bold">{priceInfo.priceMonthlyDirect}</span>
                        <span className="text-base font-normal text-muted-foreground self-end">/mo</span>
                        </div>
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground min-h-[1.5em]">
                  {!priceInfo.isFree ? 
                   ( <>Total: <span className="font-normal" style={{ fontFamily: 'Arial' }}>₹</span><span className="font-bold">{priceInfo.finalTotalPrice}</span> for {priceInfo.durationMonths} month{priceInfo.durationMonths > 1 ? 's' : ''}</> )
                   : ""
                  }
                </p>

                <ul className="space-y-2 text-sm pt-3"> 
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
                  disabled={plan.finalButtonIsDisabled || (isProcessingPayment && processingPlanId === plan.id)}
                  variant={plan.finalButtonVariant}
                >
                  {(isProcessingPayment && processingPlanId === plan.id) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {plan.ctaButtonContent}
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
                <p><strong>What happens when my plan expires?</strong> Your plan will automatically revert to the Free Tier, and premium features/limits will no longer apply.</p>
                 <p><strong>Can I upgrade or downgrade my plan?</strong> Choosing a new premium purchase option while on an active premium plan will extend your premium status. If you are on Free, it will start a new premium subscription.</p>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

