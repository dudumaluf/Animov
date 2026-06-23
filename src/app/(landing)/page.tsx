import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/navbar";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";
import { LevaToggle } from "@/components/shared/leva-toggle";
import { ExampleGallery } from "@/components/marketing/example-gallery";

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
      <LevaToggle />
      <Navbar />
      <HeroWithShowcase />
      <HowItWorks />
      <section className="px-6 py-24 md:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">— Qualidade real</p>
          <h2 className="mt-4 font-display text-display-lg">
            Veja o movimento, não só a foto.
          </h2>
          <p className="mt-3 max-w-xl font-body text-sm text-text-secondary">
            Movimentos de câmera cinematográficos aplicados a fotos reais de
            imóveis. Teste com a sua própria foto no editor — sem gastar créditos.
          </p>
          <div className="mt-10">
            <ExampleGallery count={6} />
          </div>
        </div>
      </section>
      <Pricing />
      <Footer />
    </>
  );
}
