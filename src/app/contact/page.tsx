import { ContactView, contactMetadata } from '@/views/ContactView'

export const generateMetadata = () => contactMetadata('fa')

export default function Page() {
  return <ContactView locale="fa" />
}
