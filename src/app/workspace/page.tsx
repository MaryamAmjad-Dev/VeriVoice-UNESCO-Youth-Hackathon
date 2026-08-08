import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { WorkspacePreview } from '@/components/workspace/WorkspacePreview';
export default function WorkspacePage(){return <><Header/><main className="bg-zinc-50 px-6 py-16 dark:bg-zinc-950 sm:py-24"><WorkspacePreview/></main><Footer/></>}