import { AboutView, aboutMetadata } from '@/views/AboutView'

export const generateMetadata = () => aboutMetadata('fa')

export default function Page() {
  return <AboutView locale="fa" />
}
