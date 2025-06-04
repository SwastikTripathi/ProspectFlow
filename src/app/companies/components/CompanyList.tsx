
'use client';

import type { Company } from '@/lib/types';
import { CompanyCard } from './CompanyCard';

interface CompanyListProps {
  companies: Company[];
  onEditCompany: (company: Company) => void;
}

export function CompanyList({ companies, onEditCompany }: CompanyListProps) {
  // The main page now handles the empty/search result message directly
  // This component just renders what it's given.
  // if (companies.length === 0) {
  //   return (
  //     <div className="text-center py-10">
  //       <p className="text-xl text-muted-foreground font-semibold">No companies found.</p>
  //       <p className="text-sm text-muted-foreground">This might be because none exist, or none match your current search/filters.</p>
  //     </div>
  //   );
  // }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} onEdit={onEditCompany} />
      ))}
    </div>
  );
}
