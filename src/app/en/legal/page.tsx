import { LegalView, legalMetadata } from '@/views/LegalView'
export const generateMetadata = () => legalMetadata('en')
export default function Page() { return <LegalView locale="en" /> }
