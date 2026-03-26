import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import Calculator from "@/components/Calculator";
import UseCases from "@/components/UseCases";
import WhyUs from "@/components/WhyUs";
import HowItWorks from "@/components/HowItWorks";
import Eligibility from "@/components/Eligibility";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import MobileCTA from "@/components/MobileCTA";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <SocialProof />
      
      <Calculator />
      <UseCases />
      <WhyUs />
      <HowItWorks />
      <Eligibility />
      <FAQ />
      <Footer />
      <MobileCTA />
    </div>
  );
};

export default Index;
