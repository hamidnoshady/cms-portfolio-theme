// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CmsForm } from '@/components/forms/CmsForm'
import type { FormDoc } from '@/lib/cms/types'

/**
 * The CMS-defined form's client behaviour.
 *
 * These are the promises the brief makes to a visitor: required fields are enforced with
 * visible, announced errors; an invalid email is blocked with a field error tied to its
 * control; the first invalid control takes focus; documented CMS field errors map back
 * onto the fields; the honeypot is invisible and silently absorbs a bot without writing
 * anything; a recoverable failure keeps what was typed; and an outcome is announced in a
 * persistent live region rather than silently swapped in. The end-to-end version of this
 * (a real browser against a real server, including the double-submit guard) lives in
 * `scripts/interaction-audit.mjs`.
 */

const form: FormDoc = {
  fields: [
    { fieldType: 'text', id: 'f-name', label: 'نام', name: 'name', required: true },
    { fieldType: 'email', id: 'f-email', label: 'ایمیل', name: 'email', required: true },
    { fieldType: 'textarea', id: 'f-message', label: 'پیام', name: 'message', required: true },
    { fieldType: 'checkbox', id: 'f-consent', label: 'موافقم', name: 'consent', required: true },
  ],
  id: 'form-contact',
  submitButtonLabel: 'ارسال',
  title: 'فرم تماس',
}

const posts: { body?: unknown; url: string }[] = []

beforeEach(() => {
  posts.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      posts.push({ body: init?.body, url: String(url) })
      return new Response('{"message":"submitted"}', {
        headers: { 'content-type': 'application/json' },
        status: 201,
      })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const fill = (container: HTMLElement, values: Record<string, string>) => {
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(container.querySelector(`[name="${name}"]`) as Element, { target: { value } })
  }
}

const consent = (container: HTMLElement) => fireEvent.click(container.querySelector('[name="consent"]') as Element)

describe('required-field validation', () => {
  it('marks every empty required field invalid and posts nothing', async () => {
    const { container } = render(<CmsForm form={form} locale="fa" />)
    fireEvent.submit(container.querySelector('form') as Element)

    await waitFor(() => expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(4))
    expect(posts).toHaveLength(0)
    // The error is tied to its control so a screen reader announces it on focus.
    const field = container.querySelector('[name="name"]') as Element
    const describedBy = field.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(container.querySelector(`#${CSS.escape(describedBy as string)}`)?.textContent).toContain('الزامی')
  })

  it('clears a field error as soon as the visitor types in it', async () => {
    const { container } = render(<CmsForm form={form} locale="fa" />)
    fireEvent.submit(container.querySelector('form') as Element)
    await waitFor(() => expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(4))

    fill(container, { name: 'نمونه' })
    await waitFor(() => expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(3))
  })

  it('refuses a consent checkbox that was not ticked', async () => {
    const { container } = render(<CmsForm form={form} locale="en" />)
    fill(container, { email: 'a@example.com', message: 'hi', name: 'x' })
    fireEvent.submit(container.querySelector('form') as Element)

    await waitFor(() => expect(container.querySelector('[name="consent"]')?.getAttribute('aria-invalid')).toBe('true'))
    expect(posts).toHaveLength(0)
  })

  it('blocks a malformed email with a tied field error and focuses the first invalid field', async () => {
    const { container } = render(<CmsForm form={form} locale="fa" />)
    fill(container, { email: 'not-an-email', message: 'سلام', name: 'نمونه' })
    consent(container)
    fireEvent.submit(container.querySelector('form') as Element)

    await waitFor(() => expect(container.querySelector('[name="email"]')?.getAttribute('aria-invalid')).toBe('true'))
    const email = container.querySelector('[name="email"]') as HTMLInputElement
    expect(container.querySelector(`#${CSS.escape(email.getAttribute('aria-describedby') as string)}`)?.textContent).toContain('ایمیل')
    expect(posts).toHaveLength(0)
    // The first invalid control (declared order: email before message/name) is focused.
    await waitFor(() => expect(document.activeElement).toBe(email))

    // Correcting it clears the error and lets the submission through.
    fill(container, { email: 'valid@example.com' })
    await waitFor(() => expect(email.getAttribute('aria-invalid')).toBeNull())
    fireEvent.submit(container.querySelector('form') as Element)
    await waitFor(() => expect(posts).toHaveLength(1))
  })

  it('maps documented CMS field errors back onto the fields and keeps values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('{"errors":[{"field":"email","message":"نشانی ایمیل مورد پذیرش نیست."}]}', {
          headers: { 'content-type': 'application/json' },
          status: 400,
        }),
      ),
    )
    const { container } = render(<CmsForm form={form} locale="fa" />)
    fill(container, { email: 'blocked@example.com', message: 'سلام', name: 'نمونه' })
    consent(container)
    fireEvent.submit(container.querySelector('form') as Element)

    await waitFor(() =>
      expect(container.querySelector('[name="email"]')?.getAttribute('aria-invalid')).toBe('true'),
    )
    const email = container.querySelector('[name="email"]') as HTMLInputElement
    expect(container.querySelector(`#${CSS.escape(email.getAttribute('aria-describedby') as string)}`)?.textContent).toContain(
      'مورد پذیرش نیست',
    )
    expect(email.value).toBe('blocked@example.com')
  })
})

describe('submission', () => {
  const complete = async (container: HTMLElement) => {
    fill(container, { email: 'a@example.com', message: 'سلام', name: 'نمونه' })
    consent(container)
    fireEvent.submit(container.querySelector('form') as Element)
  }

  it('posts the CMS field names and values, then announces success', async () => {
    const { container } = render(<CmsForm form={form} locale="fa" />)
    await complete(container)

    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.url).toBe('/api/form-submissions')
    const body = JSON.parse(String(posts[0]!.body)) as { form: string; submissionData: { field: string; value: string }[] }
    expect(body.form).toBe('form-contact')
    expect(body.submissionData).toEqual(
      expect.arrayContaining([
        { field: 'name', value: 'نمونه' },
        { field: 'email', value: 'a@example.com' },
        // A boolean becomes a string: the CMS field is text, not a checkbox.
        { field: 'consent', value: 'true' },
      ]),
    )

    // The outcome is announced by the persistent live region *and* shown to sighted
    // visitors; at least one copy must sit inside the live region.
    const confirmed = await screen.findAllByText('پیام شما ثبت شد.')
    expect(confirmed.some((node) => node.closest('[aria-live="polite"]') !== null)).toBe(true)
  })

  it('keeps what was typed when the CMS rejects the submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"errors":[]}', { status: 500 })),
    )
    const { container } = render(<CmsForm form={form} locale="fa" />)
    await complete(container)

    const failures = await screen.findAllByText(/ارسال فرم انجام نشد/)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some((node) => node.closest('[aria-live="polite"]') !== null)).toBe(true)
    expect((container.querySelector('[name="email"]') as HTMLInputElement).value).toBe('a@example.com')
    expect((container.querySelector('[name="message"]') as HTMLTextAreaElement).value).toBe('سلام')
  })

  it('disables the submit control while the request is in flight', async () => {
    let release: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => {
        release = resolve
      })),
    )
    const { container } = render(<CmsForm form={form} locale="fa" />)
    await complete(container)

    await waitFor(() => expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true))
    release(new Response('{}', { status: 201 }))
    await waitFor(() => expect(screen.getAllByText('پیام شما ثبت شد.').length).toBeGreaterThan(0))
  })
})

describe('honeypot', () => {
  it('is hidden, unreachable by keyboard and unannounced', () => {
    const { container } = render(<CmsForm form={form} locale="fa" />)
    const trap = container.querySelector('[name="__eshobe_website_check"]') as HTMLInputElement
    expect(trap).not.toBeNull()
    expect(trap.tabIndex).toBe(-1)
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(trap.closest('.hidden')).not.toBeNull()
    // Never required: a human must not be blocked by a field they cannot see.
    expect(trap.required).toBe(false)
  })

  it('absorbs a bot without writing anything to the CMS', async () => {
    const { container } = render(<CmsForm form={form} locale="fa" />)
    await (async () => {
      fill(container, { email: 'bot@example.com', message: 'spam', name: 'bot' })
      consent(container)
      fill(container, { __eshobe_website_check: 'filled by a bot' })
      fireEvent.submit(container.querySelector('form') as Element)
    })()

    expect((await screen.findAllByText('پیام شما ثبت شد.')).length).toBeGreaterThan(0)
    expect(posts).toHaveLength(0)
  })

  it('submits a legitimate Company value normally (no false honeypot)', async () => {
    const withCompany: FormDoc = {
      ...form,
      fields: [...(form.fields ?? []), { fieldType: 'text', id: 'f-company', label: 'Company', name: 'company', required: false }],
    }
    const { container } = render(<CmsForm form={withCompany} locale="en" />)
    fill(container, { company: 'Acme Studio', email: 'a@acme.test', message: 'hello', name: 'Ann' })
    consent(container)
    fireEvent.submit(container.querySelector('form') as Element)
    await waitFor(() => expect(posts).toHaveLength(1))
    const sent = JSON.parse(String((posts[0] as { body: unknown }).body)) as { submissionData: Array<{ field: string; value: string }> }
    expect(sent.submissionData.find((e) => e.field === 'company')?.value).toBe('Acme Studio')
  })

  it('rejects a CMS field named like the reserved honeypot', async () => {
    const { isReservedFieldName, validateFieldNames } = await import('@/domain/portfolio')
    expect(isReservedFieldName('__eshobe_website_check')).toBe(true)
    expect(isReservedFieldName('company')).toBe(false)
    expect(validateFieldNames(['company', '__eshobe_website_check'])).toEqual(['__eshobe_website_check'])
  })
})
