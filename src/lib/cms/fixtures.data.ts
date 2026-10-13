/**
 * Development fixtures — **synthetic placeholder content, never shipped customer
 * content**. Enabled only when `NODE_ENV !== 'production'` *and*
 * `ESHOBE_DEV_FIXTURES=1` (see `fixtures.ts`).
 *
 * The shapes here mirror `docs/THEME_API.md` exactly (`pages`, `posts`, `categories`,
 * `header`, `footer`, `forms`, `GET /api/site`), so the fixtures exercise the real
 * client, the real routing rules and the real block registry. Nothing in here is a
 * studio identity: titles are explicitly "sample", contact details use `example.com`
 * and placeholder numbers, and the logo is a neutral geometric placeholder that exists
 * only to prove the branding slot works.
 */

import type { BlockRow } from './types'

const paragraph = (text: string) => ({
  children: [{ text, type: 'text', version: 1 }],
  direction: null,
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
})

const lexical = (...texts: string[]) => ({
  root: {
    children: texts.map(paragraph),
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const upload = (media: unknown) => ({
  children: [],
  fields: {},
  relationTo: 'media',
  type: 'upload',
  value: media,
  version: 1,
})

/** A Payload lexical block: `blockName` is the label the editor typed on the block. */
const lexicalBlock = (blockName: string, fields: Record<string, unknown>) => ({
  fields: { blockName, ...fields },
  format: '',
  type: 'block',
  version: 2,
})

const heading = (text: string) => ({
  children: [{ text, type: 'text', version: 1 }],
  direction: null,
  format: '',
  indent: 0,
  tag: 'h2',
  type: 'heading',
  version: 1,
})

export const FIXTURE_ORIGIN_FALLBACK = 'http://localhost:3000'

/** Media is same-origin in fixtures: files live in `public/qa/media/*`. */
export const media = (
  file: string,
  width: number,
  height: number,
  alt: string,
  mimeType = 'image/jpeg',
) => ({
  alt,
  height,
  id: `media-${file}`,
  mimeType,
  url: `/qa/media/${file}`,
  width,
})

const projectMedia = {
  bagh: media('project-03.jpg', 1600, 1067, 'نمونهٔ تصویر پروژه — حیاط و دیوار'),
  hammam: media('project-04.jpg', 1000, 1000, 'نمونهٔ تصویر پروژه — پلان مربع'),
  khaneye: media('project-01.jpg', 1600, 1067, 'نمونهٔ تصویر پروژه — نمای خانه'),
  madrese: media('project-06.jpg', 1600, 1067, 'نمونهٔ تصویر پروژه — راهرو'),
  ofogh: media('project-02.jpg', 1200, 1600, 'نمونهٔ تصویر پروژه — برج اداری'),
  sazeh: media('project-05.jpg', 1200, 1600, 'نمونهٔ تصویر پروژه — سازه'),
}

export const FIXTURE_CATEGORIES = [
  { id: 'cat-projects', parent: null, slug: 'projects', title: 'پروژه‌ها' },
  { id: 'cat-residential', parent: 'cat-projects', slug: 'residential', title: 'مسکونی' },
  { id: 'cat-commercial', parent: 'cat-projects', slug: 'commercial', title: 'تجاری' },
  { id: 'cat-education', parent: null, slug: 'education', title: 'آموزش' },
  { id: 'cat-workshops', parent: 'cat-education', slug: 'workshops', title: 'کارگاه‌ها' },
  { id: 'cat-notes', parent: null, slug: 'notes', title: 'یادداشت‌ها' },
  { id: 'cat-objects', parent: null, slug: 'objects', title: 'آبژه‌ها' },
  { id: 'cat-lamps', parent: 'cat-objects', slug: 'lamps', title: 'چراغ‌ها' },
]

type FixturePost = {
  categories: string[]
  content: unknown
  heroImage?: unknown
  id: string
  meta: { description: string }
  populatedAuthors: { id: string; name: string }[]
  projectMetadata?: Record<string, unknown>
  publishedAt: string
  relatedPosts?: string[]
  slug: string
  title: string
  updatedAt: string
  _status: 'published'
}

const project = (
  id: string,
  slug: string,
  title: string,
  description: string,
  categories: string[],
  publishedAt: string,
  image: unknown,
  paragraphs: string[],
  projectMetadata: Record<string, unknown>,
): FixturePost => ({
  _status: 'published',
  categories,
  content: {
    root: {
      children: [...paragraphs.map(paragraph), upload(image)],
      direction: 'rtl',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  },
  heroImage: image,
  id,
  meta: { description },
  populatedAuthors: [{ id: 'author-1', name: 'دفتر نمونه' }],
  projectMetadata,
  publishedAt,
  slug,
  title,
  updatedAt: publishedAt,
})

export const FIXTURE_POSTS: FixturePost[] = [
  project(
    'post-p1',
    'khaneye-noor',
    'خانه‌ای در نور — نمونه',
    'نمونهٔ پروژهٔ مسکونی برای بررسی چیدمان کارت و صفحهٔ جزئیات.',
    ['cat-residential'],
    '2025-11-02T09:00:00.000Z',
    projectMedia.khaneye,
    [
      'این متن نمونه است و فقط برای بررسی تایپوگرافی، فاصله‌ها و رفتار متن راست‌به‌چپ نوشته شده است.',
      'در این صفحه جزئیات، تنها داده‌هایی نمایش داده می‌شود که از CMS آمده باشد؛ هیچ متر و تاریخ و کارفرمایی حدس زده نمی‌شود.',
      'تصویر زیر از رسانهٔ همان سند خوانده می‌شود و نسبت ابعادش از خود فایل می‌آید.',
    ],
    {
      additionalFacts: [{ label: 'پیمانکار', value: 'نمونه' }],
      area: '۲۱۰ مترمربع',
      date: '۱۴۰۴',
      location: 'تهران',
      status: 'ساخته‌شده',
    },
  ),
  project(
    'post-p2',
    'ofogh-office',
    'دفتر افق — نمونه',
    'نمونهٔ پروژهٔ تجاری با نسبت تصویر عمودی.',
    ['cat-commercial'],
    '2025-09-18T09:00:00.000Z',
    projectMedia.ofogh,
    [
      'نسبت تصویر این پروژه عمودی است و قاب کارت باید همان نسبت واقعی را نگه دارد، نه اینکه تصویر را ببرد.',
      'کارت‌های عمودی و افقی در یک آرشیو کنار هم می‌آیند و ریتم بصری می‌سازند.',
    ],
    { area: '۹۵۰ مترمربع', date: '۱۴۰۳', location: 'اصفهان', status: 'در حال ساخت' },
  ),
  project(
    'post-p3',
    'bagh-va-divar',
    'باغ و دیوار — نمونه',
    'نمونهٔ پروژهٔ مسکونی با حیاط مرکزی.',
    ['cat-residential'],
    '2025-07-04T09:00:00.000Z',
    projectMedia.bagh,
    ['متن نمونه برای سنجش ریتم سطرها و فاصلهٔ سطرها در زبان فارسی.'],
    { area: '۳۴۰ مترمربع', date: '۱۴۰۲', location: 'شیراز' },
  ),
  project(
    'post-p4',
    'hammam-kohan',
    'حمام کهن — نمونه',
    'نمونهٔ پروژهٔ مرمت با تصویر مربع.',
    ['cat-residential'],
    '2025-05-22T09:00:00.000Z',
    projectMedia.hammam,
    ['تصویر مربع باید در قاب مربع بماند و نباید به اجبار برش بخورد.'],
    { date: '۱۴۰۱', location: 'یزد', status: 'مرمت‌شده' },
  ),
  project(
    'post-p5',
    'sazeh-sorkh',
    'سازهٔ سرخ — نمونه',
    'نمونهٔ پروژهٔ تجاری با تصویر عمودی بلند.',
    ['cat-commercial'],
    '2025-03-11T09:00:00.000Z',
    projectMedia.sazeh,
    ['فهرست واقعیت‌ها فقط زمانی نمایش داده می‌شود که CMS داده‌ای برگردانده باشد.'],
    { area: '۱۲۰۰ مترمربع', location: 'تبریز' },
  ),
  project(
    'post-p6',
    'madrese-e-aban',
    'دبستان آبان — نمونه',
    'نمونهٔ پروژهٔ آموزشی با راهروی طولانی.',
    ['cat-residential'],
    '2025-01-28T09:00:00.000Z',
    projectMedia.madrese,
    ['متن نمونه برای بررسی صفحهٔ جزئیات پروژه با گالری رسانه.'],
    { area: '۲۴۰۰ مترمربع', date: '۱۴۰۰', location: 'کرج', status: 'ساخته‌شده' },
  ),
  project(
    'post-o1',
    'raw-lamp',
    'چراغ RAW — نمونه',
    'نمونهٔ آبژه با بدنهٔ خام.',
    ['cat-lamps'],
    '2025-08-10T09:00:00.000Z',
    projectMedia.bagh,
    ['متن نمونه برای آبژه.'],
    { date: '۱۴۰۳', location: 'تهران', status: 'Object' },
  ),
  project(
    'post-o2',
    'carved-panels',
    'پنل‌های کنده‌کاری — نمونه',
    'نمونهٔ آبژهٔ دوم.',
    ['cat-lamps'],
    '2025-06-15T09:00:00.000Z',
    projectMedia.sazeh,
    ['متن نمونه برای آبژهٔ دوم.'],
    { date: '۱۴۰۲', location: 'اصفهان', status: 'Object' },
  ),
  {
    // Several named media grids in one narrative — the case the project page has to
    // lay out: each set of renders under its own label, in the full container width.
    _status: 'published',
    categories: ['cat-residential'],
    content: {
      root: {
        children: [
          paragraph('نمونهٔ پروژه‌ای با چند مجموعه تصویر؛ هر مجموعه نام خودش را دارد.'),
          heading('رندرها'),
          lexicalBlock('طبقه همکف و لابی', {
            aspect: '1/1',
            blockType: 'mediaGrid',
            columns: '3',
            images: [
              media('gallery-01.jpg', 1600, 1067, 'نمونهٔ رندر ۱'),
              media('gallery-02.jpg', 1200, 1600, 'نمونهٔ رندر ۲'),
              media('gallery-03.jpg', 1000, 1000, 'نمونهٔ رندر ۳'),
              media('project-03.jpg', 1600, 1067, 'نمونهٔ رندر ۴'),
              media('project-04.jpg', 1000, 1000, 'نمونهٔ رندر ۵'),
              media('project-06.jpg', 1600, 1067, 'نمونهٔ رندر ۶'),
            ],
          }),
          lexicalBlock('طبقه اول: استخر', {
            aspect: '3/2',
            blockType: 'mediaGrid',
            caption: 'نمونهٔ زیرنویس برای مجموعه',
            columns: '2',
            images: [media('block-01.jpg', 1600, 1067, 'نمونهٔ استخر ۱'), media('project-01.jpg', 1600, 1067, 'نمونهٔ استخر ۲')],
          }),
          paragraph('طبقه اول و دوم بدنسازی.'),
          heading('پلان'),
          lexicalBlock('پلان طبقه همکف', {
            aspect: '4/3',
            blockType: 'mediaBlock',
            media: media('about-studio.jpg', 1000, 1300, 'نمونهٔ پلان'),
            size: 'content',
          }),
          heading('اجرا'),
          lexicalBlock('پیشرفت کار', {
            aspect: '4/3',
            blockType: 'mediaGrid',
            columns: '3',
            images: [
              media('gallery-01.jpg', 1600, 1067, 'نمونهٔ اجرا ۱'),
              media('gallery-02.jpg', 1200, 1600, 'نمونهٔ اجرا ۲'),
              media('gallery-03.jpg', 1000, 1000, 'نمونهٔ اجرا ۳'),
            ],
          }),
        ],
        direction: 'rtl',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    },
    heroImage: projectMedia.ofogh,
    id: 'post-p7',
    meta: { description: 'نمونهٔ پروژه با چند مجموعهٔ تصویر نام‌دار.' },
    populatedAuthors: [{ id: 'author-1', name: 'دفتر نمونه' }],
    projectMetadata: { area: '۲۵۰ مترمربع', date: '۱۴۰۵', location: 'رشت', status: 'اتمام' },
    publishedAt: '2025-12-20T09:00:00.000Z',
    relatedPosts: ['post-p1', 'post-p3'],
    slug: 'villa-398',
    title: 'پروژهٔ مجموعهٔ ورزشی — نمونه',
    updatedAt: '2025-12-20T09:00:00.000Z',
  },
  {
    _status: 'published',
    categories: ['cat-workshops'],
    content: {
      root: {
        children: [
          paragraph('این کارگاه نمونه برای بررسی صفحهٔ آموزش و زمان مطالعهٔ واقعی نوشته شده است.'),
          paragraph('مدت زمان مطالعه از شمارش واقعی واژه‌های همین متن محاسبه می‌شود، نه از یک عدد ثابت.'),
        ],
        direction: 'rtl',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    },
    heroImage: media('education-01.jpg', 1600, 1067, 'نمونهٔ تصویر ورکشاپ'),
    id: 'post-e1',
    meta: { description: 'نمونهٔ ورکشاپ طراحی.' },
    populatedAuthors: [{ id: 'author-2', name: 'گروه نمونه' }],
    publishedAt: '2025-10-12T09:00:00.000Z',
    slug: 'workshop-design-basics',
    title: 'کارگاه مبانی طراحی — نمونه',
    updatedAt: '2025-10-12T09:00:00.000Z',
  },
  {
    _status: 'published',
    categories: ['cat-workshops'],
    content: { root: { children: [paragraph('توضیح کوتاه ورکشاپ نمونه.')], direction: 'rtl', format: '', indent: 0, type: 'root', version: 1 } },
    heroImage: media('education-02.jpg', 1200, 1600, 'نمونهٔ تصویر ورکشاپ عمودی'),
    id: 'post-e2',
    meta: { description: 'نمونهٔ ورکشاپ نور.' },
    populatedAuthors: [{ id: 'author-2', name: 'گروه نمونه' }],
    publishedAt: '2025-08-02T09:00:00.000Z',
    slug: 'workshop-light',
    title: 'کارگاه نور و سایه — نمونه',
    updatedAt: '2025-08-02T09:00:00.000Z',
  },
  {
    _status: 'published',
    categories: ['cat-workshops'],
    content: { root: { children: [paragraph('ورکشاپ نمونهٔ متریال با متن کوتاه.')], direction: 'rtl', format: '', indent: 0, type: 'root', version: 1 } },
    id: 'post-e3',
    meta: { description: 'نمونهٔ ورکشاپ متریال.' },
    populatedAuthors: [{ id: 'author-3', name: 'مهمان' }],
    publishedAt: '2025-06-15T09:00:00.000Z',
    slug: 'workshop-material',
    title: 'کارگاه متریال — نمونه',
    updatedAt: '2025-06-15T09:00:00.000Z',
  },
  {
    _status: 'published',
    categories: ['cat-notes'],
    content: {
      root: {
        children: [
          paragraph('یادداشت نمونهٔ نخست: دربارهٔ ریتم خطوط در نما و اینکه هر خط باید دلیل داشته باشد.'),
          paragraph('در این متن عمداً چند جمله آمده تا عرض ستون خواندن و فاصلهٔ سطرها بررسی شود.'),
        ],
        direction: 'rtl',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    },
    heroImage: media('note-01.jpg', 1600, 1067, 'نمونهٔ تصویر یادداشت'),
    id: 'post-n1',
    meta: { description: 'یادداشت نمونه دربارهٔ خطوط.' },
    populatedAuthors: [{ id: 'author-1', name: 'دفتر نمونه' }],
    publishedAt: '2025-12-01T09:00:00.000Z',
    relatedPosts: ['post-n2'],
    slug: 'notes-on-lines',
    title: 'یادداشتی دربارهٔ خطوط — نمونه',
    updatedAt: '2025-12-01T09:00:00.000Z',
  },
  {
    _status: 'published',
    categories: ['cat-notes'],
    content: { root: { children: [paragraph('یادداشت نمونهٔ دوم دربارهٔ سکوت و فاصله.')], direction: 'rtl', format: '', indent: 0, type: 'root', version: 1 } },
    id: 'post-n2',
    meta: { description: 'یادداشت نمونهٔ دوم.' },
    populatedAuthors: [{ id: 'author-1', name: 'دفتر نمونه' }],
    publishedAt: '2025-11-20T09:00:00.000Z',
    slug: 'notes-on-silence',
    title: 'یادداشت نمونه دربارهٔ سکوت',
    updatedAt: '2025-11-20T09:00:00.000Z',
  },
  {
    _status: 'published',
    categories: ['cat-notes'],
    content: { root: { children: [paragraph('یادداشت نمونهٔ سوم بدون تصویر شاخص.')], direction: 'rtl', format: '', indent: 0, type: 'root', version: 1 } },
    id: 'post-n3',
    meta: { description: 'یادداشت نمونهٔ سوم.' },
    populatedAuthors: [{ id: 'author-1', name: 'دفتر نمونه' }],
    publishedAt: '2025-10-05T09:00:00.000Z',
    slug: 'notes-without-image',
    title: 'یادداشت نمونه بدون تصویر',
    updatedAt: '2025-10-05T09:00:00.000Z',
  },
]

/**
 * Field names follow the CMS `contact` block exactly (`address`, `email`, `phones[]`,
 * `hours`, plus the shared section intro) — a mismatch here would make the theme look
 * broken while the theme's own renderer was correct.
 */
const contactBlock: BlockRow = {
  address: 'نشانی نمونه، تهران — این جزئیات آزمایشی است.',
  blockType: 'contact',
  email: 'hello@example.com',
  heading: 'تماس — نمونه',
  hours: 'شنبه تا چهارشنبه، ۹ تا ۱۷ — نمونه',
  id: 'block-contact',
  intro: 'این جزئیات نمونه است و از CMS می‌آید.',
  mapUrl: 'https://maps.example.com/?q=35.6892,51.3890',
  phones: ['02112345678', '09121234567'],
}

const servicesBlocks: BlockRow[] = [
  {
    blockType: 'content',
    columns: [
      {
        enableLink: false,
        richText: lexical('خدمات نمونه: طراحی معماری، بازسازی و نظارت — این متن فقط برای بررسی بلوک محتوا است.'),
        size: 'full',
      },
    ],
    heading: 'خدمات (نمونه)',
    id: 'block-content-1',
  },
  { blockType: 'mediaBlock', id: 'block-media-1', media: media('block-01.jpg', 1600, 1067, 'نمونهٔ تصویر بلوک رسانه') },
  {
    blockType: 'features',
    columns: '3',
    heading: 'فرآیند (نمونه)',
    id: 'block-features-1',
    items: [
      { description: 'گفت‌وگوی نخست و تعریف مسئله.', title: 'برداشت' },
      { description: 'طراحی و بازبینی گزینه‌ها.', title: 'پیش‌طراحی' },
      { description: 'نظارت تا پایان کار.', title: 'اجرا' },
    ],
  },
  {
    blockType: 'faq',
    id: 'block-faq-1',
    items: [
      { answer: 'بازهٔ زمانی نمونه، برای بررسی چیدمان آکاردئون.', question: 'زمان اجرا چقدر است؟ (نمونه)' },
      { answer: 'پاسخ نمونهٔ دوم.', question: 'روش همکاری چگونه است؟ (نمونه)' },
    ],
  },
  {
    blockType: 'gallery',
    columns: '2',
    id: 'block-gallery-1',
    images: [
      { image: media('gallery-01.jpg', 1600, 1067, 'نمونهٔ گالری ۱') },
      { image: media('gallery-02.jpg', 1200, 1600, 'نمونهٔ گالری ۲') },
      { image: media('gallery-03.jpg', 1000, 1000, 'نمونهٔ گالری ۳') },
    ],
  },
]

export const FIXTURE_PAGES = [
  {
    _status: 'published',
    hero: {
      media: media('about-studio.jpg', 1000, 1300, 'تصویر نمونهٔ دفتر'),
      richText: lexical(
        'این متن نمونه درباره‌ی دفتر است و فقط برای بررسی صفحهٔ «درباره ما» با فضای سفید زیاد نوشته شده است.',
        'بلوک‌هایی که در CMS تنظیم شوند پس از همین ترکیب کم‌گو نمایش داده می‌شوند.',
      ),
      type: 'mediumImpact',
    },
    id: 'pg-about',
    layout: [],
    meta: { description: 'نمونهٔ صفحهٔ درباره ما.' },
    slug: 'about',
    title: 'درباره ما (نمونه)',
  },
  {
    _status: 'published',
    hero: {
      richText: lexical('برای گفت‌وگو دربارهٔ یک پروژه، فرم کوتاه زیر را پر کنید. این متن و جزئیات نمونه‌اند.'),
      type: 'mediumImpact',
    },
    id: 'pg-contact',
    layout: [contactBlock, { blockType: 'formBlock', form: 'form-contact', id: 'block-form-1' }],
    meta: { description: 'نمونهٔ صفحهٔ تماس.' },
    slug: 'contact',
    title: 'تماس (نمونه)',
  },
  {
    _status: 'published',
    hero: { richText: lexical('صفحهٔ نمونه برای بررسی رجیستری بلوک‌ها.'), type: 'lowImpact' },
    id: 'pg-services',
    layout: servicesBlocks,
    meta: { description: 'نمونهٔ صفحهٔ خدمات.' },
    slug: 'services',
    title: 'خدمات (نمونه)',
  },
]

export const FIXTURE_HEADER = {
  id: 'header-1',
  navItems: [
    { id: 'nav-1', link: { label: 'پروژه‌ها', type: 'custom', url: '/projects' } },
    { id: 'nav-2', link: { label: 'آموزش', type: 'custom', url: '/education' } },
    { id: 'nav-3', link: { label: 'یادداشت‌ها', type: 'custom', url: '/blog' } },
    { id: 'nav-4', link: { label: 'درباره ما', reference: { relationTo: 'pages', value: 'pg-about' }, type: 'reference' } },
    { id: 'nav-5', link: { label: 'تماس', reference: { relationTo: 'pages', value: 'pg-contact' }, type: 'reference' } },
    // A `posts` reference carries a document id, so it exercises the id lookup rather
    // than the slug lookup the archive routes use.
    { id: 'nav-6', link: { label: 'یادداشت برگزیده', reference: { relationTo: 'posts', value: 'post-n1' }, type: 'reference' } },
  ],
}

export const FIXTURE_FOOTER = {
  id: 'footer-1',
  navItems: [
    { id: 'foot-1', link: { label: 'خدمات (نمونه)', reference: { relationTo: 'pages', value: 'pg-services' }, type: 'reference' } },
    { id: 'foot-2', link: { label: 'ایمیل نمونه', type: 'custom', url: 'mailto:hello@example.com' } },
  ],
}

export const FIXTURE_FORM = {
  confirmationMessage: lexical('پیام نمونهٔ شما ثبت شد. این یک دادهٔ آزمایشی است.'),
  confirmationType: 'message' as const,
  fields: [
    { fieldType: 'text', id: 'f-name', label: 'نام', name: 'name', required: true },
    { fieldType: 'email', id: 'f-email', label: 'ایمیل', name: 'email', required: true },
    { fieldType: 'text', id: 'f-phone', label: 'تلفن', name: 'phone', required: false },
    // `message` is Payload's display-only block; the real input type is `textarea`.
    { fieldType: 'textarea', id: 'f-message', label: 'پیام', name: 'message', required: true },
    { fieldType: 'checkbox', id: 'f-consent', label: 'با ثبت این فرم موافقم', name: 'consent', required: true },
  ],
  id: 'form-contact',
  submitButtonLabel: 'ارسال',
  title: 'فرم تماس (نمونه)',
}

export const FIXTURE_AUTHORS = { 'author-1': 'دفتر نمونه', 'author-2': 'گروه نمونه', 'author-3': 'مهمان' }

export const fixtureSite = (origin: string) => ({
  availableLocales: ['fa', 'en'],
  blocks: [
    'content',
    'mediaBlock',
    'cta',
    'features',
    'testimonials',
    'faq',
    'contact',
    'formBlock',
    'gallery',
    'archive',
  ],
  branding: {
    compactLogo: media('logo.svg', 64, 64, 'نشان نمونه', 'image/svg+xml'),
    homeLogo: null,
    primaryLogo: media('logo.svg', 64, 64, 'نشان نمونه', 'image/svg+xml'),
  },
  contractVersion: 1,
  defaultLocale: 'fa',
  domain: new URL(origin).host,
  media: { basePath: '/api/media/file', origin },
  name: 'استودیوی نمونه',
  slug: 'dev-fixtures',
  status: 'active',
  store: { currency: 'IRT', paymentProvider: null },
  theme: { accent: '#000000', background: '#ffffff', foreground: '#000000', lineHeight: 1.8, primary: '#000000', radius: 'none' },
  themeRuntime: {
    bindings: {
      about: { id: 'pg-about', slug: 'about', title: 'درباره ما (نمونه)', type: 'page' },
      blogCategory: null,
      contact: { id: 'pg-contact', slug: 'contact', title: 'تماس (نمونه)', type: 'page' },
      objectsCategory: { id: 'cat-objects', slug: 'objects', title: 'آبژه‌ها', type: 'category' },
      educationCategory: { id: 'cat-education', slug: 'education', title: 'آموزش', type: 'category' },
      home: null,
      projectsCategory: { id: 'cat-projects', slug: 'projects', title: 'پروژه‌ها', type: 'category' },
      contactForm: { id: 'form-contact', slug: null, title: 'فرم تماس', type: 'form' },
      careersForm: { id: 'form-careers', slug: null, title: 'فرم همکاری', type: 'form' },
      careers: { id: 'pg-careers', slug: 'careers', title: 'همکاری (نمونه)', type: 'page' },
      legal: { id: 'pg-legal', slug: 'legal', title: 'حقوقی (نمونه)', type: 'page' },
    },
    package: { key: 'dev-fixtures' },
    settings: { introAnimation: true, introDuration: 1200 },
    theme: { key: 'dev-fixtures' },
  },
  type: 'portfolio',
})

export const FIXTURE_MEDIA_FILES = [
  'about-studio.jpg',
  'block-01.jpg',
  'education-01.jpg',
  'education-02.jpg',
  'gallery-01.jpg',
  'gallery-02.jpg',
  'gallery-03.jpg',
  'logo.svg',
  'note-01.jpg',
  'project-01.jpg',
  'project-02.jpg',
  'project-03.jpg',
  'project-04.jpg',
  'project-05.jpg',
  'project-06.jpg',
]
