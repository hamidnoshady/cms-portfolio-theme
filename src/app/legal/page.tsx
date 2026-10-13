import { LegalView, legalMetadata } from '@/views/LegalView'
export const generateMetadata = () => legalMetadata('fa')
export default function Page() { return <LegalView locale="fa" /> }
