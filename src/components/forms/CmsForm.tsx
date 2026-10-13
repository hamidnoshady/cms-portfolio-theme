'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormDoc, FormField } from '@/lib/cms/types'
import { labels as dictionary } from '@/lib/theme/labels'
import type { Locale } from '@/lib/cms/types'

/**
 * CMS-defined form.
 *
 * The field list, labels and required flags come from the `forms` document — the theme
 * never invents fields and never relaxes a required one. Submissions go to
 * `/api/form-submissions` on this origin (the theme proxies it to the CMS, which
 * derives the tenant from the form document server-side).
 *
 * Accessibility and resilience: visible labels tied with `htmlFor`, `aria-invalid` +
 * `aria-describedby` on errors, values preserved on a recoverable failure, and
 * submission disabled while pending so a double click cannot file two enquiries.
 *
 * Validation is client-side for format (required, email shape, numeric) and the first
 * invalid field receives focus; the CMS remains authoritative and its documented
 * `{ errors: [{ field, message }] }` validation response is mapped back onto the
 * fields, with anything unmapped shown together with the generic failure message. A
 * persistent live region announces pending/success/failure. The hidden
 * `__eshobe_website_check` input is the CMS canonical honeypot: bots fill it,
 * humans never see it, and a filled value is silently accepted without writing
 * anything. `company` is a legitimate business field and must submit normally.
 */

/** Deliberately permissive: shape check, not RFC 5322 theatre. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u

type FieldError = { field: null | string; message: string }

/** Payload's documented `ValidationError`: `{ errors: [{ field, message }] }`. */
const parseFieldErrors = (body: unknown): FieldError[] => {
  if (!body || typeof body !== 'object') return []
  const errors = (body as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return []
  return errors.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as { field?: unknown; message?: unknown }
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    if (!message) return []
    const field = typeof record.field === 'string' && record.field ? record.field : null
    return [{ field, message }]
  })
}
export const CmsForm = ({
  className,
  form,
  locale,
}: {
  className?: string
  form: FormDoc
  locale: Locale
}) => {
  const t = dictionary(locale)
  const uid = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Record<string, boolean | string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [invalidOrder, setInvalidOrder] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const [serverMessages, setServerMessages] = useState<string[]>([])
  const [status, setStatus] = useState<'error' | 'idle' | 'pending' | 'success'>('idle')

  const fields = (form.fields ?? []).filter((field) => field.name && field.fieldType !== 'message')
  const messages = (form.fields ?? []).filter((field) => field.fieldType === 'message')

  const setValue = (name: string, value: boolean | string): void => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    for (const field of fields) {
      const value = values[field.name]
      const empty = field.fieldType === 'checkbox' ? value !== true : !String(value ?? '').trim()
      if (field.required && empty) {
        next[field.name] = locale === 'fa' ? 'این فیلد الزامی است.' : 'This field is required.'
        continue
      }
      if (empty) continue
      if (field.fieldType === 'email' && !EMAIL_PATTERN.test(String(value).trim())) {
        next[field.name] = locale === 'fa' ? 'نشانی ایمیل معتبر نیست.' : 'Enter a valid email address.'
        continue
      }
      if (field.fieldType === 'number' && !Number.isFinite(Number(String(value).trim()))) {
        next[field.name] = locale === 'fa' ? 'عدد معتبر وارد کنید.' : 'Enter a valid number.'
      }
    }
    setErrors(next)
    // Insertion order follows the field order, so the first entry is the first control.
    setInvalidOrder(Object.keys(next))
    setAttempt((current) => current + 1)
    return Object.keys(next).length === 0
  }

  // Focus the first invalid control after the errors have rendered. This is an effect
  // because focus is a DOM side effect of the submit event, not derived state.
  useEffect(() => {
    if (attempt === 0) return
    const first = invalidOrder[0]
    if (!first) return
    document.getElementById(`${uid}-${first}`)?.focus()
  }, [attempt, invalidOrder, uid])

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (status === 'pending') return
    if (!validate()) return

    // Canonical CMS honeypot (`src/lib/public-form-fields.ts` in eshobe-cms).
    // Never treat `company` as spam: Bang's contact form has a real Company field.
    if (String(values.__eshobe_website_check ?? '').trim().length > 0) {
      setStatus('success')
      return
    }

    setStatus('pending')
    try {
      const response = await fetch('/api/form-submissions', {
        body: JSON.stringify({
          form: form.id,
          submissionData: fields.filter((field) => field.name !== '__eshobe_website_check').map((field) => ({
            field: field.name,
            value: normalizeValue(values[field.name]),
          })),
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as unknown
        const known = new Set(fields.map((field) => field.name))
        const mapped: Record<string, string> = {}
        const unmapped: string[] = []
        for (const entry of parseFieldErrors(body)) {
          if (entry.field && known.has(entry.field)) mapped[entry.field] = entry.message
          else unmapped.push(entry.message)
        }
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped)
          setInvalidOrder(Object.keys(mapped))
          setAttempt((current) => current + 1)
        }
        setServerMessages(unmapped)
        setStatus('error')
        // Entered values are intentionally kept: a recoverable failure must not make
        // the visitor type the enquiry again.
        return
      }
      setStatus('success')
      setValues({})
    } catch {
      setStatus('error')
    }
  }

  const statusText =
    status === 'pending' ? t.formPending : status === 'success' ? t.formSuccess : status === 'error' ? t.formError : ''

  return (
    <div className={className}>
      {/* One live region for the whole lifecycle, mounted before its text changes. */}
      <p aria-live="polite" className="sr-only" role="status">
        {statusText}
      </p>

      {status === 'success' ? (
        <p className="type-body">{t.formSuccess}</p>
      ) : (
        <form noValidate onSubmit={onSubmit} ref={formRef}>
          <div className="flex flex-col gap-6">
            {messages.map((field) => (
              <p className="type-body" key={field.id ?? field.name}>
                {field.label}
              </p>
            ))}

            {fields.map((field) => (
              <Field
                error={errors[field.name]}
                field={field}
                id={`${uid}-${field.name}`}
                key={field.id ?? field.name}
                locale={locale}
                onChange={(value) => setValue(field.name, value)}
                value={values[field.name]}
              />
            ))}

            {/* Canonical honeypot — not announced, not focusable, never required.
                Named exactly as the CMS contract; CMS field names must not collide. */}
            <div aria-hidden="true" className="hidden">
              <label htmlFor={`${uid}-__eshobe_website_check`}>Website</label>
              <input
                autoComplete="off"
                id={`${uid}-__eshobe_website_check`}
                name="__eshobe_website_check"
                onChange={(event) => setValue('__eshobe_website_check', event.target.value)}
                tabIndex={-1}
                type="text"
                value={String(values.__eshobe_website_check ?? '')}
              />
            </div>

            {status === 'error' ? (
              <div className="type-error">
                <p>{t.formError}</p>
                {serverMessages.length > 0 ? (
                  <ul className="mt-1 list-none">
                    {serverMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div>
              <Button disabled={status === 'pending'} type="submit">
                {status === 'pending' ? t.formPending : (form.submitButtonLabel ?? t.enter)}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

const normalizeValue = (value: boolean | string | undefined): string =>
  typeof value === 'boolean' ? String(value) : (value ?? '')

const Field = ({
  error,
  field,
  id,
  locale,
  onChange,
  value,
}: {
  error?: string
  field: FormField
  id: string
  locale: Locale
  onChange: (value: boolean | string) => void
  value: boolean | string | undefined
}) => {
  const label = field.label ?? field.name
  const describedBy = error ? `${id}-error` : undefined
  const required = Boolean(field.required)

  if (field.fieldType === 'checkbox') {
    return (
      <div className="field">
        <div className="flex items-start gap-3">
          <input
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            checked={value === true}
            id={id}
            name={field.name}
            onChange={(event) => onChange(event.target.checked)}
            required={required}
            type="checkbox"
          />
          <Label className="field__check-label" htmlFor={id}>
            {label}
          </Label>
        </div>
        {error ? (
          <p className="field__error" id={`${id}-error`}>
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="field">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {renderControl(field, id, value, onChange, describedBy, Boolean(error), required, locale)}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

const renderControl = (
  field: FormField,
  id: string,
  value: boolean | string | undefined,
  onChange: (value: boolean | string) => void,
  describedBy: string | undefined,
  invalid: boolean,
  required: boolean,
  locale: Locale,
) => {
  const common = {
    'aria-describedby': describedBy,
    'aria-invalid': invalid ? (true as const) : undefined,
    id,
    name: field.name,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    required,
    value: String(value ?? ''),
  }

  switch (field.fieldType) {
    case 'textarea':
      return <Textarea {...common} rows={5} />
    case 'email':
      return <Input {...common} autoComplete="email" dir="ltr" type="email" />
    case 'number':
      return <Input {...common} inputMode="numeric" type="number" />
    case 'select':
      // Deliberately a native control: the CMS defines the options, the field must work
      // without JavaScript, and the form's value is read from React state. The themed
      // shadcn Select is reserved for dropdown filters, and the archives filter with
      // links instead.
      return (
        <select {...common} className="field__control">
          <option value="">{locale === 'fa' ? 'انتخاب کنید' : 'Select…'}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    // `country`/`state` are plugin fields whose option lists are injected by the CMS
    // admin, not returned by the API; they render as plain text inputs here.
    case 'country':
      return <Input {...common} autoComplete="country-name" type="text" />
    case 'state':
      return <Input {...common} autoComplete="address-level1" type="text" />
    // `text` is the CMS's catch-all input (Payload has no `tel` field type), so the
    // field *name* decides the browser hints: a phone-like field must not offer to
    // autofill the visitor's name, and its digits need LTR isolation inside an RTL form.
    default: {
      const numeric = /(fax|mobile|phone|postal|tel|zip)/iu.test(field.name)
      return (
        <Input
          {...common}
          autoComplete={numeric ? 'tel' : 'on'}
          dir={numeric ? 'ltr' : undefined}
          inputMode={numeric ? 'tel' : undefined}
          type="text"
        />
      )
    }
  }
}
