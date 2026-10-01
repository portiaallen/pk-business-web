import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { Introduction } from "@/components/sections/Introduction";
import { ServiceCards } from "@/components/sections/ServiceCards";
import { WhyPKSection } from "@/components/sections/WhyPKSection";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { CTASection } from "@/components/CTASection";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: {
    absolute: "PK Business Services | Bookkeeping & Financial Documentation",
  },
  description: siteConfig.description,
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Introduction />
      <ServiceCards />
      <WhyPKSection />
      <HowItWorks />
      <CTASection
        title="Let’s take it off your mental to-do list."
        description="Tell PK what needs attention. We’ll help you determine the right service and a practical next step."
      />
    </>
  );
}
