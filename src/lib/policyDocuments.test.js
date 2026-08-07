import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FOOTER_POLICY_LINKS,
  getPolicyDoc,
  POLICY_DOCS,
  policyDocPlainText,
} from './policyDocuments.js'

const BRACKET_PLACEHOLDER = /\[[^\]]+\]/

describe('policyDocuments — Terms & Conditions', () => {
  it('has section content without bracket placeholders or draft flags', () => {
    const doc = getPolicyDoc('terms')
    assert.ok(doc)
    assert.equal(doc.title, 'Terms & Conditions')
    assert.ok(doc.lastUpdated)
    assert.doesNotMatch(doc.lastUpdated, BRACKET_PLACEHOLDER)
    assert.equal(doc.isDraft, undefined)
    assert.match(doc.intro, /Welcome to CarPharmacy/)
    const headings = doc.sections.map((s) => s.heading)
    for (const required of [
      '1. Acceptance of Terms',
      '2. Use of the Service',
      '3. Orders, Pricing & Payment',
      '4. Shipping & Delivery',
      '5. Returns & Refunds',
      '6. Product Information & Fitment Disclaimer',
      '7. User Accounts & Responsibilities',
      '8. Limitation of Liability',
      '9. Governing Law & Jurisdiction',
      '10. Changes to These Terms',
      '11. Contact Information',
    ]) {
      assert.ok(headings.includes(required), `missing section: ${required}`)
    }
    const payment = doc.sections.find((s) => s.heading === '3. Orders, Pricing & Payment')
    assert.match(payment.body, /Razorpay/)
    assert.doesNotMatch(policyDocPlainText(doc), BRACKET_PLACEHOLDER)
    const refunds = doc.sections.find((s) => s.heading === '5. Returns & Refunds')
    assert.match(refunds.body, /after the returned item is received and inspected/)
    assert.ok(refunds.body.trim().length > 0)
    const jurisdiction = doc.sections.find((s) => s.heading === '9. Governing Law & Jurisdiction')
    assert.match(jurisdiction.body, /courts of India/)
    const contact = doc.sections.find((s) => s.heading === '11. Contact Information')
    assert.match(contact.body, /please contact us/)
    assert.ok(contact.body.trim().length > 0)
  })
})

describe('policyDocuments — Privacy Policy', () => {
  it('has section content without bracket placeholders or draft flags', () => {
    const doc = getPolicyDoc('privacy')
    assert.ok(doc)
    assert.equal(doc.title, 'Privacy Policy')
    assert.ok(doc.lastUpdated)
    assert.doesNotMatch(doc.lastUpdated, BRACKET_PLACEHOLDER)
    assert.equal(doc.isDraft, undefined)
    const headings = doc.sections.map((s) => s.heading)
    for (const required of [
      '1. Information We Collect',
      '2. How We Use Your Information',
      '3. Cookies & Tracking',
      '4. Payment Information Handling',
      '5. Data Sharing & Third Parties',
      '6. Data Retention',
      '7. Your Rights',
      "8. Children's Privacy",
      '9. Data Security',
      '10. Changes to This Policy',
      '11. Contact Us',
    ]) {
      assert.ok(headings.includes(required), `missing section: ${required}`)
    }
    const payment = doc.sections.find((s) => s.heading === '4. Payment Information Handling')
    assert.match(payment.body, /Razorpay/)
    assert.doesNotMatch(policyDocPlainText(doc), BRACKET_PLACEHOLDER)
    for (const section of doc.sections) {
      assert.ok(section.body.trim().length > 0, `empty body: ${section.heading}`)
    }
  })
})

describe('policy documents clean rendering data', () => {
  it('does not export a draft/legal-review banner notice', () => {
    assert.equal('POLICY_DRAFT_NOTICE' in POLICY_DOCS, false)
    assert.equal(getPolicyDoc('terms').isDraft, undefined)
    assert.equal(getPolicyDoc('privacy').isDraft, undefined)
  })

  it('every Terms and Privacy section has non-empty trimmed body text', () => {
    for (const kind of ['terms', 'privacy']) {
      const doc = getPolicyDoc(kind)
      for (const section of doc.sections) {
        assert.equal(section.body, section.body.trimEnd())
        assert.ok(section.body.trim().length > 0)
      }
    }
  })
})

describe('footer policy links and routes', () => {
  it('exposes /privacy and /terms links for the footer', () => {
    const paths = FOOTER_POLICY_LINKS.map((l) => l.to)
    assert.ok(paths.includes('/privacy'))
    assert.ok(paths.includes('/terms'))
    const terms = FOOTER_POLICY_LINKS.find((l) => l.to === '/terms')
    assert.equal(terms.label, 'Terms & Conditions')
  })

  it('every footer policy link has a matching policy doc kind', () => {
    for (const link of FOOTER_POLICY_LINKS) {
      const kind = link.to.replace(/^\//, '')
      assert.ok(POLICY_DOCS[kind], `missing POLICY_DOCS entry for ${kind}`)
    }
  })
})
