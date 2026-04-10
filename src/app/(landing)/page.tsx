import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/navbar";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";

const HeroWithShowcase = dynamic(
  () =>
    import("@/components/landing/hero-with-showcase").then(
      (mod) => mod.HeroWithShowcase,
    ),
  { ssr: false },
);

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <HeroWithShowcase />
      <HowItWorks />
      <Pricing />
      <Footer />
    </>
  );
}
