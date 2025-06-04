
'use client';

import type { Company } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Globe, Linkedin, Info } from 'lucide-react';

interface CompanyCardProps {
  company: Company;
  onEdit: (company: Company) => void;
}

export function CompanyCard({ company, onEdit }: CompanyCardProps) {
  return (
    <Card 
      className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col cursor-pointer"
      onClick={() => onEdit(company)}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="font-headline text-xl mb-1 flex items-center">
            <Building2 className="mr-2 h-5 w-5 text-primary" />
            {company.name}
          </CardTitle>
        </div>
        {company.website && (
            <a 
              href={company.website} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm text-accent hover:underline flex items-center"
              onClick={(e) => e.stopPropagation()} // Prevent card click when link is clicked
            >
                <Globe className="mr-1 h-3 w-3" /> Website
            </a>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm flex-grow">
        {company.linkedin_url && (
          <div className="flex items-center">
            <Linkedin className="mr-2 h-4 w-4 text-muted-foreground" />
            <a 
              href={company.linkedin_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-accent hover:underline truncate"
              onClick={(e) => e.stopPropagation()} // Prevent card click when link is clicked
            >
              LinkedIn Profile
            </a>
          </div>
        )}
        {company.notes && (
          <div className="flex items-start pt-1">
            <Info className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground italic break-words">{company.notes}</p>
          </div>
        )}
         {!company.linkedin_url && !company.notes && !company.website && ( // Adjusted condition
            <p className="text-xs text-muted-foreground">No additional details provided.</p>
        )}
      </CardContent>
      {/* CardFooter removed as the whole card is clickable */}
    </Card>
  );
}
