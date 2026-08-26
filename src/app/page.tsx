import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { Introduction } from "@/components/sections/Introduction";
import { ServiceCards } from "@/components/sections/ServiceCards";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { TrustSection } from "@/components/sections/TrustSection";
import { CTASection } from "@/components/CTASection";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Bookkeeping, QuickBooks Support & Financial Documentation",
  description: siteConfig.description,
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Introduction />
      <ServiceCards />
      <HowItWorks />
      <TrustSection />
      <CTASection
        title="Ready to Get Your Records in Order?"
        description="Whether your books need a cleanup, your business records need organizing, or you need help documenting legitimate income information, PK Business Services can help you determine the right place to start."
      />
    </>
  );
}
