import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";

const PresetShowcase = dynamic(
  () =>
    import("@/components/landing/preset-showcase").then(
      (mod) => mod.PresetShowcase,
    ),
  { ssr: false },
);

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <PresetShowcase />
      <HowItWorks />
      <Pricing />
      <Footer />
    </>
  );
}
