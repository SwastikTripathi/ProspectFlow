
'use client';

import type { JobOpening, FollowUp } from '@/lib/types'; 
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, Mail, User, ExternalLink, Tag as TagIcon, MessageSquareText, Copy, MailCheck, Loader2, AlertCircle, RotateCcw, CheckCircle, Users as UsersIcon } from 'lucide-react';
import { format, isValid, isToday, isBefore, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import React, { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface JobOpeningCardProps {
  opening: JobOpening;
  onEdit: (opening: JobOpening) => void;
  onLogFollowUp: (followUpId: string, jobOpeningId: string) => Promise<void>;
  onUnlogFollowUp: (followUpId: string, jobOpeningId: string) => Promise<void>;
}

// Helper to ensure console logs are not too verbose in production builds if needed
const logDebug = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    // console.log(...args);
  }
};


export function JobOpeningCard({ opening, onEdit, onLogFollowUp, onUnlogFollowUp }: JobOpeningCardProps) {
  const { toast } = useToast();
  const [isLoggingFollowUp, setIsLoggingFollowUp] = useState(false);
  const [isUnloggingFollowUp, setIsUnloggingFollowUp] = useState(false);
  
  const followUpsArray = useMemo(() => 
    Array.isArray(opening.followUps) ? opening.followUps.map(fu => ({...fu, follow_up_date: new Date(fu.follow_up_date)})) : [], 
    [opening.followUps]
  );

  const displayContactNames = useMemo(() => {
    if (!opening.associated_contacts || opening.associated_contacts.length === 0) {
      return 'No contacts linked.';
    }
    return opening.associated_contacts.map(c => c.name).join(', ');
  }, [opening.associated_contacts]);

  const firstEmail = useMemo(() => {
    return opening.associated_contacts?.[0]?.email;
  }, [opening.associated_contacts]);

  const hasMoreEmails = useMemo(() => {
    return (opening.associated_contacts?.length || 0) > 1;
  }, [opening.associated_contacts]);

  const allEmailsString = useMemo(() => {
    if (!opening.associated_contacts || opening.associated_contacts.length === 0) {
      return '';
    }
    return opening.associated_contacts.map(c => c.email).join(', ');
  }, [opening.associated_contacts]);


  useEffect(() => {
    logDebug(`[Card Mount/Update ID: ${opening.id}] Received opening.followUps:`, followUpsArray.map(f => ({id: f.id, date: f.follow_up_date, status: f.status, created_at: f.created_at, original_due_date: f.original_due_date })));
  }, [followUpsArray, opening.id]);

  const upcomingPendingFollowUps = useMemo(() => {
    const itemsToFilterAndSort = followUpsArray.map(fu => ({
      id: fu.id,
      status: fu.status,
      date: fu.follow_up_date, 
      isValidDate: isValid(fu.follow_up_date),
      formattedDate: fu.follow_up_date && isValid(fu.follow_up_date) ? format(fu.follow_up_date, 'yyyy-MM-dd HH:mm:ss XXX') : 'Invalid Date'
    }));
    logDebug(`[Card ID: ${opening.id}] upcomingPendingFollowUps - Items BEFORE filter/sort:`, JSON.parse(JSON.stringify(itemsToFilterAndSort)));

    const filtered = followUpsArray
      .filter(fu => {
        const isValidDate = fu.follow_up_date && isValid(fu.follow_up_date);
        return fu.status === 'Pending' && isValidDate;
      })
      .sort((a, b) => a.follow_up_date.getTime() - b.follow_up_date.getTime());
    logDebug(`[Card ID: ${opening.id}] upcomingPendingFollowUps - Result:`, filtered.map(f => ({id: f.id, date: f.follow_up_date && isValid(f.follow_up_date) ? format(f.follow_up_date, 'yyyy-MM-dd') : 'Invalid Date', status: f.status })));
    return filtered;
  }, [followUpsArray, opening.id]);

  const nextFollowUp = useMemo(() => 
    upcomingPendingFollowUps.length > 0 ? upcomingPendingFollowUps[0] : undefined,
    [upcomingPendingFollowUps]
  );
   
  useEffect(() => {
    logDebug(`[Card State Update ID: ${opening.id}] nextFollowUp:`, nextFollowUp ? {id: nextFollowUp.id, date: nextFollowUp.follow_up_date, status: nextFollowUp.status} : 'undefined', `| upcomingPendingFollowUps count: ${upcomingPendingFollowUps.length}`);
  }, [nextFollowUp, upcomingPendingFollowUps, opening.id]);


  const firstFollowUpEmailContentExists = followUpsArray[0]?.email_content && followUpsArray[0].email_content.trim() !== '';

  const lastSentFollowUpLoggedToday = useMemo(() => {
    let latestSent: FollowUp | null = null;
    // Iterate in reverse to find the latest-in-sequence FU that was sent today
    for (let i = followUpsArray.length - 1; i >= 0; i--) {
      const fu = followUpsArray[i];
      if (
        fu.status === 'Sent' &&
        fu.follow_up_date && 
        isValid(fu.follow_up_date) &&
        isToday(fu.follow_up_date) 
      ) {
        latestSent = fu; 
        break; 
      }
    }
    return latestSent;
  }, [followUpsArray]);


  const isOverdue = useMemo(() => {
    if (nextFollowUp && nextFollowUp.status === 'Pending' && nextFollowUp.follow_up_date && isValid(nextFollowUp.follow_up_date)) {
      // Ensure we are comparing just the date parts by using startOfDay for comparison
      const nextFollowUpDayStart = startOfDay(nextFollowUp.follow_up_date);
      const todayStart = startOfDay(new Date());
      return isBefore(nextFollowUpDayStart, todayStart);
    }
    return false;
  }, [nextFollowUp]);


  const copyToClipboard = (text: string, fieldName: string = "Text", event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!navigator.clipboard) {
      toast({ title: "Copy Failed", description: "Clipboard API not available.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${fieldName} Copied!`, description: `${fieldName === 'All Emails' ? 'All associated emails copied.' : text + ' copied.'}` });
    }).catch(err => {
      console.error(`Failed to copy ${fieldName.toLowerCase()}: `, err);
      toast({ title: "Copy Failed", description: `Could not copy.`, variant: "destructive" });
    });
  };

  const formattedInitialEmailDate = opening.initial_email_date && isValid(opening.initial_email_date)
    ? format(opening.initial_email_date, 'PPP')
    : 'Invalid Date';

  const formattedNextFollowUpDate = nextFollowUp && nextFollowUp.follow_up_date && isValid(nextFollowUp.follow_up_date)
    ? format(nextFollowUp.follow_up_date, 'PPP')
    : null;
  

  const handleLogFollowUpClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!nextFollowUp || !nextFollowUp.id) return;
    setIsLoggingFollowUp(true);
    try { await onLogFollowUp(nextFollowUp.id, opening.id); } 
    catch (error) { console.error("Error logging follow-up from card:", error); } 
    finally { setIsLoggingFollowUp(false); }
  };
  
  const handleUnlogFollowUpClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!lastSentFollowUpLoggedToday || !lastSentFollowUpLoggedToday.id) return;
    
    logDebug(`[Card Unlog Click ID: ${opening.id}] Unlogging FollowUpID: ${lastSentFollowUpLoggedToday.id}`);
    // (window as any).lastUnloggedFollowUpId = lastSentFollowUpLoggedToday.id; // For diagnostics

    setIsUnloggingFollowUp(true);
    try { await onUnlogFollowUp(lastSentFollowUpLoggedToday.id, opening.id); } 
    catch (error) { console.error("Error unlogging follow-up from card:", error); toast({ title: "Unlog Error", variant: "destructive" }); } 
    finally { setIsUnloggingFollowUp(false); }
  };
  
  let footerContent;
  const hasAnyFollowUps = followUpsArray.length > 0;

  if (nextFollowUp && nextFollowUp.status === 'Pending') {
    footerContent = (
      <Button variant="outline" size="sm" className="w-full" onClick={handleLogFollowUpClick} disabled={isLoggingFollowUp || isUnloggingFollowUp}>
        {isLoggingFollowUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />} Log Follow-up
      </Button>
    );
  } else if (hasAnyFollowUps && !nextFollowUp) { 
    footerContent = (<Button variant="outline" size="sm" className="w-full" disabled> <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> All Followed up </Button>);
  } else { 
     footerContent = (<Button variant="outline" size="sm" className="w-full" disabled> <AlertCircle className="mr-2 h-4 w-4" /> No Follow-ups </Button>);
  }

  const bannerBaseClasses = "flex items-center p-2 rounded-md text-xs";
  const bannerRedStyle = "bg-destructive/15 text-destructive border border-destructive/30";
  const bannerInfoStyle = "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20"; 
  const bannerUpcomingStyle = "bg-primary/10 text-primary border border-primary/20";

  const isNextFollowUpToday = nextFollowUp?.follow_up_date && isValid(nextFollowUp.follow_up_date) && isToday(nextFollowUp.follow_up_date);


  return (
    <Card 
      className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col", isOverdue && nextFollowUp && nextFollowUp.status === 'Pending' && "border-destructive border-2" )}
      onClick={() => onEdit(opening)}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="font-headline text-xl mb-1">{opening.role_title}</CardTitle>
          <Badge variant={['Hot Lead', 'Interviewing', 'Offer', 'Replied - Positive'].includes(opening.status) ? 'default' : 'secondary'} className="capitalize">
            {opening.status}
          </Badge>
        </div>
        <CardDescription className="text-primary">{opening.company_name_cache}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm flex-grow">
        {opening.associated_contacts && opening.associated_contacts.length > 0 ? (
            <>
            <div className="flex items-center">
              <User className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate" title={displayContactNames}>{displayContactNames}</span>
            </div>
            {firstEmail && (
              <div className="flex items-center">
                <Mail className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a href={`mailto:${firstEmail}`} className="text-accent hover:underline truncate" title={allEmailsString} onClick={(e) => e.stopPropagation()}>
                  {firstEmail}{hasMoreEmails && ', ...'}
                </a>
                <Button variant="ghost" size="icon" className="h-6 w-6 p-1 ml-1.5 text-muted-foreground hover:text-accent hover:bg-transparent" onClick={(e) => copyToClipboard(allEmailsString, "All Emails", e)} title="Copy all emails">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            </>
        ) : (
            <div className="flex items-center text-muted-foreground">
                 <UsersIcon className="mr-2 h-4 w-4" /> No contacts linked.
            </div>
        )}

        <div className="flex items-center">
          <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Initial Email: {formattedInitialEmailDate}</span>
        </div>
        
        {isOverdue && formattedNextFollowUpDate && nextFollowUp && nextFollowUp.status === 'Pending' && (
          <div className={cn(bannerBaseClasses, bannerRedStyle)}>
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>Overdue: <span className="font-semibold">{formattedNextFollowUpDate}</span></span>
          </div>
        )}
        
        {!isOverdue && formattedNextFollowUpDate && nextFollowUp && nextFollowUp.status === 'Pending' && (
           <div className={cn(bannerBaseClasses, isNextFollowUpToday ? bannerInfoStyle : bannerUpcomingStyle )}>
            <CalendarDays className="mr-2 h-4 w-4" /> 
            <span>Next Follow-up: <span className="font-semibold">{formattedNextFollowUpDate}</span></span>
          </div>
        )}

         {firstFollowUpEmailContentExists && (
          <div className="flex items-center text-xs text-muted-foreground pt-1">
            <MessageSquareText className="mr-1 h-3 w-3 text-accent" />
            <span>Follow-up email content drafted</span>
          </div>
        )}
        {opening.tags && (opening.tags as string[]).length > 0 && (
           <div className="flex items-center flex-wrap gap-1 pt-2">
             <TagIcon className="mr-1 h-4 w-4 text-muted-foreground" />
             {(opening.tags as string[]).map(tag => ( <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge> ))}
           </div>
        )}
        {opening.job_description_url && (
            <div className="flex items-center">
                <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" />
                <a href={opening.job_description_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate" onClick={(e) => e.stopPropagation()}> Job Description </a>
            </div>
        )}
        {opening.notes && (<p className="text-xs text-muted-foreground pt-1 italic break-words">Notes: {opening.notes}</p>)}
      </CardContent>
      <CardFooter className="border-t pt-4 flex space-x-2">
        {footerContent}
        {lastSentFollowUpLoggedToday && (
            <Button variant="outline" size="sm" className="w-auto p-2" onClick={handleUnlogFollowUpClick} disabled={isUnloggingFollowUp || isLoggingFollowUp} title="Unlog today's follow-up">
                {isUnloggingFollowUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            </Button>
        )}
      </CardFooter>
    </Card>
  );
}
