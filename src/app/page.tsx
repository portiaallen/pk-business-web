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
        title="Ready to Get Your Records in Order?"
        description="Whether your books need a cleanup, your business records need organizing, or you need help documenting legitimate income information, PK Business Services can help you determine the right place to start."
      />
    </>
  );
}
