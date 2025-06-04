
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import type { UserSubscription, AvailablePlan } from '@/lib/types';
import { ALL_AVAILABLE_PLANS } from '@/lib/config'; // Import centralized plans
import { useToast } from './use-toast';

interface UseCurrentSubscriptionReturn {
  currentSubscription: UserSubscription | null;
  subscriptionLoading: boolean;
  availablePlans: AvailablePlan[];
}

export function useCurrentSubscription(): UseCurrentSubscriptionReturn {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setCurrentUser(session?.user ?? null);
        if (!session?.user) {
          setCurrentSubscription(null);
          setSubscriptionLoading(false);
        }
      }
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
       if(!user) setSubscriptionLoading(false);
    });
    return () => authListener.subscription?.unsubscribe();
  }, []);

  const fetchSubscription = useCallback(async () => {
    if (!currentUser) {
      setCurrentSubscription(null);
      setSubscriptionLoading(false);
      return;
    }
    setSubscriptionLoading(true);
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
        // No active subscription, default to 'free' effectively
        setCurrentSubscription(null); 
      }
    } catch (error: any) {
      toast({ title: 'Error Fetching Subscription Status', description: error.message, variant: 'destructive' });
      setCurrentSubscription(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser) {
        fetchSubscription();
    } else {
        setSubscriptionLoading(false);
        setCurrentSubscription(null);
    }
  }, [currentUser, fetchSubscription]);

  return { currentSubscription, subscriptionLoading, availablePlans: ALL_AVAILABLE_PLANS };
}
