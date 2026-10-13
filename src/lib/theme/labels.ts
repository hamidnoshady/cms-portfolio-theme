import type { Locale } from '@/lib/cms/types'
import { formatNumber } from '@/lib/runtime'

/** Interface strings. Persian first, English second — chrome only, content lives in CMS. */
type Dictionary = {
  about: string
  objects: string
  careers: string
  legal: string
  allProjects: string
  allObjects: string
  breadcrumb: string
  close: string
  contact: string
  emptyArchiveBody: string
  emptyArchiveTitle: string
  enter: string
  errorBody: string
  errorTitle: string
  featured: string
  formError: string
  formPending: string
  formSuccess: string
  browseProjects: string
  browseObjects: string
  home: string
  languageSwitch: string
  loading: string
  menu: string
  menuTitle: string
  next: string
  notFoundBody: string
  notFoundTitle: string
  previous: string
  projects: string
  reload: string
  skipToContent: string
  holdingTitle: string
  holdingBody: string
  unreachableTitle: string
  unreachableBody: string
  relatedWork: string
  gallery: string
  projectFacts: string
  photo: string
  share: string
  shareDone: string
  shareFailed: string
  copyLink: string
  copied: string
  inquiry: string
  team: string
  biography: string
  openBiography: string
  selectedWork: string
  contactDetailsMissing: string
  contactFormMissingTitle: string
  contactFormMissingBody: string
  careersFormMissingTitle: string
  careersFormMissingBody: string
  missingContentTitle: string
  missingContentBody: string
  startConversation: string
  contactFormMissingUseDetails: string
  map: string
  email: string
  phone: string
  hours: string
  copy: string
  showMap: string
  openMap: string
  photoAt: (position: number, total: number) => string
  selectedWorkCount: (total: number) => string
  selectedWorkShown: (shown: number, total: number) => string
}

const fa: Dictionary = {
  about: 'درباره ما',
  objects: 'آبژه‌ها',
  careers: 'همکاری',
  legal: 'حقوقی',
  allProjects: 'همه پروژه‌ها',
  allObjects: 'همه آبژه‌ها',
  breadcrumb: 'مسیر صفحه',
  close: 'بستن',
  contact: 'تماس',
  emptyArchiveBody: 'به‌زودی در این بخش اثر تازه‌ای منتشر می‌شود.',
  emptyArchiveTitle: 'هنوز چیزی منتشر نشده است',
  enter: 'ورود',
  errorBody: 'نمایش این بخش ممکن نشد. می‌توانید دوباره تلاش کنید.',
  errorTitle: 'خطا در بارگذاری',
  featured: 'شاخص',
  formError: 'ارسال فرم انجام نشد. مقادیر وارد‌شده حفظ شده‌اند؛ دوباره تلاش کنید.',
  formPending: 'در حال ارسال…',
  formSuccess: 'پیام شما ثبت شد.',
  browseProjects: 'دیدن پروژه‌ها',
  browseObjects: 'دیدن آبژه‌ها',
  home: 'خانه',
  languageSwitch: 'زبان',
  loading: 'در حال بارگذاری…',
  menu: 'فهرست',
  menuTitle: 'فهرست سایت',
  next: 'بعدی',
  notFoundBody: 'نشانی درخواستی در این سایت وجود ندارد.',
  notFoundTitle: 'صفحه پیدا نشد',
  previous: 'پیشین',
  projects: 'پروژه‌ها',
  reload: 'تلاش دوباره',
  skipToContent: 'رفتن به محتوا',
  holdingTitle: 'این سایت موقتاً در دسترس نیست',
  holdingBody: 'در حال حاضر امکان نمایش محتوای این سایت وجود ندارد.',
  unreachableTitle: 'اتصال به سامانهٔ محتوا برقرار نشد',
  unreachableBody: 'این نسخه به CMS متصل نیست. تنظیمات اتصال را بررسی کنید.',
  relatedWork: 'آثار مرتبط',
  gallery: 'تصاویر',
  projectFacts: 'مشخصات اثر',
  photo: 'تصویر',
  share: 'اشتراک‌گذاری',
  shareDone: 'پیوند کپی شد.',
  shareFailed: 'اشتراک‌گذاری انجام نشد؛ پیوند را دستی کپی کنید.',
  copyLink: 'کپی پیوند',
  copied: 'کپی شد',
  inquiry: 'استعلام درباره این اثر',
  team: 'تیم',
  biography: 'زندگینامه',
  openBiography: 'خواندن زندگینامه',
  selectedWork: 'نمونه کارها',
  contactDetailsMissing: 'اطلاعات تماس هنوز منتشر نشده است.',
  contactFormMissingTitle: 'فرم تماس در دسترس نیست',
  contactFormMissingBody: 'فرم تماس هنوز برای این زبان منتشر نشده است.',
  careersFormMissingTitle: 'فرم همکاری در دسترس نیست',
  careersFormMissingBody: 'فرم همکاری هنوز برای این زبان منتشر نشده است.',
  missingContentTitle: 'محتوای این بخش هنوز تنظیم نشده است',
  missingContentBody: 'مدیر سایت هنوز این بخش را در CMS پیوند نداده است.',
  startConversation: 'گفتگو را شروع کنیم',
  contactFormMissingUseDetails: 'فرم تماس هنوز منتشر نشده است؛ از راه‌های تماسِ همین صفحه استفاده کنید.',
  map: 'نقشه',
  email: 'ایمیل',
  phone: 'تلفن',
  hours: 'ساعات کاری',
  copy: 'کپی',
  showMap: 'نمایش نقشه',
  openMap: 'باز کردن در نقشه',
  photoAt: (position, total) => `تصویر ${formatNumber(position, 'fa')} از ${formatNumber(total, 'fa')}`,
  selectedWorkCount: (total) => `${formatNumber(total, 'fa')} اثر`,
  selectedWorkShown: (shown, total) => `${formatNumber(shown, 'fa')} از ${formatNumber(total, 'fa')}`,
}

const en: Dictionary = {
  about: 'About',
  objects: 'Objects',
  careers: 'Careers',
  legal: 'Legal',
  allProjects: 'All projects',
  allObjects: 'All objects',
  breadcrumb: 'Breadcrumb',
  close: 'Close',
  contact: 'Contact',
  emptyArchiveBody: 'New work will be published here soon.',
  emptyArchiveTitle: 'Nothing published yet',
  enter: 'Enter',
  errorBody: 'This section could not be displayed. Try again.',
  errorTitle: 'Loading error',
  featured: 'Featured',
  formError: 'The form could not be sent. Your input was kept — try again.',
  formPending: 'Sending…',
  formSuccess: 'Your message was received.',
  browseProjects: 'Browse projects',
  browseObjects: 'Browse objects',
  home: 'Home',
  languageSwitch: 'Language',
  loading: 'Loading…',
  menu: 'Menu',
  menuTitle: 'Site menu',
  next: 'Next',
  notFoundBody: 'The requested address does not exist on this site.',
  notFoundTitle: 'Page not found',
  previous: 'Previous',
  projects: 'Projects',
  reload: 'Try again',
  skipToContent: 'Skip to content',
  holdingTitle: 'This site is temporarily unavailable',
  holdingBody: 'Its content cannot be displayed right now.',
  unreachableTitle: 'The content system could not be reached',
  unreachableBody: 'This deployment is not connected to the CMS. Check the connection settings.',
  relatedWork: 'Related work',
  gallery: 'Gallery',
  projectFacts: 'Work facts',
  photo: 'Photograph',
  share: 'Share',
  shareDone: 'Link copied.',
  shareFailed: 'Sharing failed; copy the link manually.',
  copyLink: 'Copy link',
  copied: 'Copied',
  inquiry: 'Enquire about this work',
  team: 'Team',
  biography: 'Biography',
  openBiography: 'Read biography',
  selectedWork: 'Selected work',
  contactDetailsMissing: 'Contact details have not been published yet.',
  contactFormMissingTitle: 'The contact form is not available',
  contactFormMissingBody: 'The contact form has not been published in English yet.',
  careersFormMissingTitle: 'The careers form is not available',
  careersFormMissingBody: 'The careers form has not been published in English yet.',
  missingContentTitle: 'This section is not configured yet',
  missingContentBody: 'The site manager has not linked this section in the CMS.',
  startConversation: 'Start a conversation',
  contactFormMissingUseDetails: 'The contact form has not been published yet; please use the contact details on this page.',
  map: 'Map',
  email: 'Email',
  phone: 'Phone',
  hours: 'Hours',
  copy: 'Copy',
  showMap: 'Show map',
  openMap: 'Open in maps',
  photoAt: (position, total) => `Photograph ${formatNumber(position, 'en')} of ${formatNumber(total, 'en')}`,
  selectedWorkCount: (total) => `${formatNumber(total, 'en')} ${total === 1 ? 'work' : 'works'}`,
  selectedWorkShown: (shown, total) => `${formatNumber(shown, 'en')} of ${formatNumber(total, 'en')}`,
}

const dictionaries: Record<Locale, Dictionary> = { en, fa }
export const labels = (locale: Locale): Dictionary => dictionaries[locale] ?? fa
export type { Dictionary }
