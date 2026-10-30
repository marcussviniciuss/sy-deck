import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { Features } from '@/components/Features';
import { Download } from '@/components/Download';
import { Footer } from '@/components/Footer';

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Download />
      </main>
      <Footer />
    </>
  );
}
