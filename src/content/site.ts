export const siteConfig = {
  name: "PK Business Services",
  tagline:
    "Bookkeeping • QuickBooks Support • Financial Documentation • Business Support",
  description:
    "Professional bookkeeping, QuickBooks support, financial record organization, and income documentation services for small businesses, self-employed professionals, entrepreneurs, and individuals.",
  nav: [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  cta: {
    label: "Request a Consultation",
    href: "/contact",
  },
  disclaimer:
    "Information provided on this website is for general service information and does not constitute legal, financial, or tax advice.",
  incomeVerificationDisclosure:
    "PK Business Services works only with authentic, client-provided financial information and legitimate documentation. We do not create, alter, fabricate, or misrepresent financial records or proof of income.",
  pricingNote:
    "Starting prices are provided for general guidance. Final pricing may vary based on scope, transaction volume, complexity, number of accounts, and condition of records.",
} as const;
