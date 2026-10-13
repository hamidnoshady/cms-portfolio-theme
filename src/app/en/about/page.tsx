import { AboutView, aboutMetadata } from '@/views/AboutView'

export const generateMetadata = () => aboutMetadata('en')

export default function Page() {
  return <AboutView locale="en" />
}
