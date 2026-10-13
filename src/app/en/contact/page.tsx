import { ContactView, contactMetadata } from '@/views/ContactView'
export const generateMetadata = () => contactMetadata('en')
export default function Page() { return <ContactView locale="en" /> }
