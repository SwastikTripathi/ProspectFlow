
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const signInSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const signUpSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type SignInFormValues = z.infer<typeof signInSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;

export default function AuthPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showConfirmationMessage, setShowConfirmationMessage] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'signin' | 'signup'>('signin');

  console.log('[AuthPage] Component rendered/re-rendered. Pathname:', pathname);

  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    console.log('[AuthPage] useEffect for session check and auth listener. isCheckingAuth:', isCheckingAuth);
    setIsCheckingAuth(true);
    const checkSession = async () => {
      console.log('[AuthPage] checkSession: Starting initial session check.');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[AuthPage] checkSession: supabase.auth.getSession() returned. Session:', session);
      if (session) {
        console.log(`[AuthPage] checkSession: Active session found. User: ${session.user?.id}. Redirecting to /.`);
        router.replace('/'); // Redirect if session already exists
      } else {
        console.log('[AuthPage] checkSession: No active session found.');
        setIsCheckingAuth(false); // Only set to false if no session, otherwise redirect handles it
      }
      // Removed setIsCheckingAuth(false) from here to avoid race condition if redirecting.
      // It will be set by the onAuthStateChange listener's INITIAL_SESSION or if no session above.
    };
    checkSession();

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthPage] onAuthStateChange: Event - ${event}, Session:`, session);
      if (event === 'SIGNED_IN' && session) {
        console.log(`[AuthPage] onAuthStateChange: SIGNED_IN event. User: ${session.user?.id}. Redirecting to /.`);
        router.replace('/'); // Redirect on SIGNED_IN
      } else if (event === 'INITIAL_SESSION' && !session) {
        // This handles the case where initial check found no session, and listener confirms it.
        setIsCheckingAuth(false);
      }
      if (event === 'USER_UPDATED') {
        console.log('[AuthPage] onAuthStateChange: USER_UPDATED event.');
      }
      if (event === 'SIGNED_OUT') {
        console.log('[AuthPage] onAuthStateChange: SIGNED_OUT event.');
        // No redirect from here, AppLayout will handle it if on protected page.
      }
    });

    return () => {
      console.log('[AuthPage] useEffect cleanup: Unsubscribing from auth state changes.');
      authSubscription?.unsubscribe();
    };
  }, []); // Empty dependency array: run once on mount for setup


  const handleSignIn = async (values: SignInFormValues) => {
    console.log('[AuthPage] handleSignIn: Attempting sign-in for email:', values.email);
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        console.error('[AuthPage] handleSignIn: Error signing in.', error);
        setAuthError(error.message);
        toast({ title: 'Sign In Failed', description: error.message, variant: 'destructive' });
      } else {
        console.log('[AuthPage] handleSignIn: Sign-in successful. router.refresh() will be called. onAuthStateChange should handle redirect.');
        toast({ title: 'Signed In Successfully!'});
        router.refresh(); // This allows AppLayout to re-evaluate and AuthPage's listener to catch SIGNED_IN
      }
    } catch (error: any) {
      console.error('[AuthPage] handleSignIn: Catch block error.', error);
      setAuthError(error.message || 'An unexpected error occurred.');
      toast({ title: 'Sign In Error', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    }
    setIsLoading(false);
    console.log('[AuthPage] handleSignIn: Finished. isLoading set to false.');
  };

  const handleSignUp = async (values: SignUpFormValues) => {
    console.log('[AuthPage] handleSignUp: Attempting sign-up for email:', values.email);
    setIsLoading(true);
    setAuthError(null);
    setShowConfirmationMessage(false);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (error) {
        console.error('[AuthPage] handleSignUp: Error signing up.', error);
        setAuthError(error.message);
        toast({ title: 'Sign Up Failed', description: error.message, variant: 'destructive' });
      } else if (data.session) {
        console.log('[AuthPage] handleSignUp: Sign-up successful, session created. router.refresh() will be called. onAuthStateChange should handle redirect. User:', data.user?.id);
        toast({ title: 'Account Created & Signed In!' });
        router.refresh(); 
      } else if (data.user && !data.session) {
        console.log('[AuthPage] handleSignUp: Sign-up successful, confirmation email sent. User:', data.user?.id);
        setShowConfirmationMessage(true);
        toast({ title: 'Account Created!', description: 'Please check your email to confirm your account.' });
        signUpForm.reset();
        signInForm.setValue('email', values.email);
        setDefaultTab('signin');
      } else {
         console.warn('[AuthPage] handleSignUp: Unexpected outcome.', data);
         setAuthError('An unexpected outcome occurred during sign up.');
         toast({ title: 'Sign Up Issue', description: 'An unexpected outcome occurred.', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('[AuthPage] handleSignUp: Catch block error.', error);
      setAuthError(error.message || 'An unexpected error occurred.');
      toast({ title: 'Sign Up Error', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    }
    setIsLoading(false);
    console.log('[AuthPage] handleSignUp: Finished. isLoading set to false.');
  };
  
  console.log('[AuthPage] Rendering. isCheckingAuth:', isCheckingAuth, 'isLoading:', isLoading);
  if (isCheckingAuth) {
    console.log('[AuthPage] Rendering loader because isCheckingAuth is true.');
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Tabs value={defaultTab} onValueChange={(value) => setDefaultTab(value as 'signin'|'signup')} className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Create Account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline">Welcome Back!</CardTitle>
              <CardDescription>Sign in to access your ProspectFlow dashboard.</CardDescription>
            </CardHeader>
            <Form {...signInForm}>
              <form onSubmit={signInForm.handleSubmit(handleSignIn)}>
                <CardContent className="space-y-4">
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signInForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   {showConfirmationMessage && (
                    <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
                      Account created! Please check your email to confirm your account before signing in.
                    </p>
                  )}
                  {authError && <p className="text-sm text-destructive">{authError}</p>}
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline">Create an Account</CardTitle>
              <CardDescription>Join ProspectFlow to streamline your outreach.</CardDescription>
            </CardHeader>
             <Form {...signUpForm}>
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)}>
                <CardContent className="space-y-4">
                   <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signUpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Must be at least 6 characters" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {authError && <p className="text-sm text-destructive">{authError}</p>}
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Account
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
