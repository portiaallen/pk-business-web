export interface TaxService {
  id: string;
  number: string;
  name: string;
  price: string;
  situation: string;
  description: string;
  scope: string[];
}

export const taxServices: TaxService[] = [
  {
    id: "tax-individual",
    number: "01",
    name: "Individual Tax Preparation",
    price: "Starting at $175",
    situation: "You have a W-2 — and a life around it.",
    description:
      "A personal return prepared with care, including the side income most people forget to mention.",
    scope: [
      "Personal return preparation",
      "Side-income & 1099 forms included properly",
      "Prior-year return review for context",
    ],
  },
  {
    id: "tax-self-employed",
    number: "02",
    name: "Self-Employed & 1099 Taxes",
    price: "Starting at $295",
    situation:
      "Freelancers, gig workers, creators, online sellers, independent contractors: income from everywhere, paperwork from nowhere.",
    description:
      "PK organizes the 1099s, the expenses, and the Schedule C, so the return reflects the real business.",
    scope: [
      "1099-NEC / 1099-K income organization",
      "Schedule C expense organization",
      "Estimated-payment guidance for next year",
    ],
  },
  {
    id: "tax-small-business",
    number: "03",
    name: "Small Business Tax Preparation",
    price: "Starting at $450",
    situation: "Your business needs its books and taxes to agree.",
    description:
      "For LLCs, S-corps, and sole proprietors. PK makes sure the books behind the return are clean enough to file on — so your return stands on solid ground.",
    scope: [
      "Business return preparation",
      "Books-to-return consistency check",
      "Owner pay & draws untangled first",
    ],
  },
  {
    id: "tax-catch-up",
    number: "04",
    name: "Prior-Year & Catch-Up Support",
    price: "Consultation-based pricing",
    situation: "You're behind. Let's fix that, one year at a time.",
    description:
      "Missing a year — or a few? Bring the notices (unopened counts). PK helps identify what's actually missing, organize what exists, and work through filings in the right order.",
    scope: [
      "Missing-year inventory",
      "Record reconstruction from what exists",
      "One filing at a time, in the right order",
    ],
  },
];
