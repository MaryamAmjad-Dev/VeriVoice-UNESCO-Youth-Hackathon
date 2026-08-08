import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/landing/Hero';
import { VisualPipeline } from '@/components/landing/VisualPipeline';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Mission } from '@/components/landing/Mission';
import { Team } from '@/components/landing/Team';
import { Stats } from '@/components/landing/Stats';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/layout/Footer';
export default function Home() { return <><Header /><main className="flex-1"><Hero /><VisualPipeline /><Features /><HowItWorks /><Mission /><Team /><Stats /><CTA /></main><Footer /></>; }