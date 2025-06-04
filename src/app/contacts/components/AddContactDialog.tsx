
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Check, ChevronsUpDown, PlusCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Company } from '@/lib/types';
import { cn } from '@/lib/utils';

// Schema matches the fields needed to create a contact, company_id is handled by parent
export const addContactFormSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  role: z.string().optional(),
  email: z.string().email("Must be a valid email address").min(1, "Email is required"),
  phone: z.string().optional(),
  company_id: z.string().optional(), // This will store the ID of the selected or new company
  company_name_input: z.string().optional(), // Used for typing/searching/creating new company
  linkedin_url: z.string().url("Must be a valid LinkedIn URL (e.g., https://linkedin.com/in/name)").optional().or(z.literal('')),
  notes: z.string().optional(),
});

export type AddContactFormValues = z.infer<typeof addContactFormSchema>;

interface AddContactDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddContactSubmit: (values: AddContactFormValues) => Promise<void>;
  companies: Company[]; // Fetched from Supabase by parent
  onAttemptCreateCompany: (companyName: string) => Promise<Company | null>; // Parent handles Supabase insert
}

export function AddContactDialog({
  isOpen,
  onOpenChange,
  onAddContactSubmit,
  companies,
  onAttemptCreateCompany
}: AddContactDialogProps) {
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  // companySearchInput is used for the CommandInput, separate from form's company_name_input
  const [companySearchInputForPopover, setCompanySearchInputForPopover] = useState('');


  const form = useForm<AddContactFormValues>({
    resolver: zodResolver(addContactFormSchema),
    defaultValues: {
      name: '',
      role: '',
      email: '',
      phone: '',
      company_id: '',
      company_name_input: '',
      linkedin_url: '',
      notes: '',
    },
  });

  const onSubmit = async (values: AddContactFormValues) => {
    // The actual company_id might need to be set here if a new company was just created
    // Or, the parent (ContactsPage) will handle this logic using company_name_input
    // For simplicity, we'll let the parent handle resolving company_name_input to company_id
    await onAddContactSubmit(values);
    // Dialog closing and toast are handled by parent on success/failure
    if (isOpen) { // If dialog is still open (e.g. error in parent), reset.
      form.reset();
      setCompanySearchInputForPopover('');
    }
  };
  
  const handleDialogValidClose = () => {
    form.reset();
    setCompanySearchInputForPopover('');
    onOpenChange(false);
  }

  const handleDialogCancel = () => {
    form.reset();
    setCompanySearchInputForPopover('');
    onOpenChange(false);
  }

  const filteredCompaniesForPopover = companies.filter(company => 
    company.name.toLowerCase().includes(companySearchInputForPopover.toLowerCase())
  );

  // Watch company_name_input for dynamic filtering if needed, or rely on popover's own input state
  const currentCompanyNameInputValue = form.watch('company_name_input');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if(!open) {
            handleDialogCancel(); // Ensures form reset on any close
        } else {
            onOpenChange(open);
        }
    }}>
      <DialogContent className="sm:max-w-[480px] shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Contact</DialogTitle>
          <DialogDescription>
            Enter the details of the professional contact.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto px-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Jane Doe" {...field} />
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
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="e.g. jane.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Marketing Manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* company_name_input is the text field for the company name, company_id stores the actual ID */}
            <FormField
              control={form.control}
              name="company_name_input" 
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Company Name (Optional)</FormLabel>
                  <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={companyPopoverOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value || "Select or type company"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Search or create company..."
                          value={companySearchInputForPopover} // Use popover-specific state for CommandInput
                          onValueChange={(currentSearchValue) => {
                             setCompanySearchInputForPopover(currentSearchValue);
                             // Update form field if user types directly into CommandInput
                             // and intends that to be the new company name if not selected
                             field.onChange(currentSearchValue); 
                          }}
                        />
                        <CommandList>
                           {filteredCompaniesForPopover.length === 0 && companySearchInputForPopover && (
                            <CommandItem
                              onSelect={async () => {
                                const newCompany = await onAttemptCreateCompany(companySearchInputForPopover);
                                if (newCompany) {
                                  form.setValue("company_name_input", newCompany.name, { shouldValidate: true });
                                  form.setValue("company_id", newCompany.id, { shouldValidate: true });
                                } else {
                                  // Handle case where company creation failed in parent (e.g. toast already shown)
                                  // Optionally clear input or leave as is for user to retry
                                }
                                setCompanyPopoverOpen(false);
                                setCompanySearchInputForPopover(''); 
                              }}
                              className="text-sm cursor-pointer"
                            >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Create & select: "{companySearchInputForPopover}"
                            </CommandItem>
                          )}
                          <CommandGroup>
                            {filteredCompaniesForPopover.map((company) => (
                              <CommandItem
                                value={company.name}
                                key={company.id}
                                onSelect={() => {
                                  form.setValue("company_name_input", company.name, { shouldValidate: true });
                                  form.setValue("company_id", company.id, {shouldValidate: true});
                                  setCompanyPopoverOpen(false);
                                  setCompanySearchInputForPopover('');
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.getValues("company_id") === company.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {company.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                           {/* Option to create if search term doesn't exactly match an existing one */}
                           {filteredCompaniesForPopover.length > 0 && companySearchInputForPopover && !companies.find(c => c.name.toLowerCase() === companySearchInputForPopover.toLowerCase()) && (
                             <CommandItem
                              onSelect={async () => {
                                const newCompany = await onAttemptCreateCompany(companySearchInputForPopover);
                                if (newCompany) {
                                  form.setValue("company_name_input", newCompany.name, { shouldValidate: true });
                                  form.setValue("company_id", newCompany.id, { shouldValidate: true });
                                }
                                setCompanyPopoverOpen(false);
                                setCompanySearchInputForPopover('');
                              }}
                              className="text-sm cursor-pointer"
                            >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Create & select: "{companySearchInputForPopover}"
                            </CommandItem>
                           )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="e.g. +1 234 567 8900" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="linkedin_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn Profile URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://linkedin.com/in/janedoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any relevant notes about this contact..." {...field} rows={3}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDialogCancel}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Contact
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
