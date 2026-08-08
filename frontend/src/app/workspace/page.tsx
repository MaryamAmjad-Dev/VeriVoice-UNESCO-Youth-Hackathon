import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VerificationWorkspace } from '@/components/workspace/VerificationWorkspace';
import { LiveClaimsDashboard } from '@/components/workspace/LiveClaimsDashboard';
export default function WorkspacePage(){return <><Header/><main className="px-6 py-12 sm:py-16"><VerificationWorkspace/><div className="mx-auto my-16 w-full max-w-7xl sm:my-20"><div className="vv-divider" /></div><LiveClaimsDashboard/></main><Footer/></>}
