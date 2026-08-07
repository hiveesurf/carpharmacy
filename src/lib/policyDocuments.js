/**
 * Public policy documents (Privacy Policy, Terms & Conditions, Returns, Warranty).
 */

/**
 * @typedef {{ heading: string, body: string }} PolicySection
 * @typedef {{
 *   title: string,
 *   lastUpdated?: string,
 *   intro?: string,
 *   sections?: PolicySection[],
 *   paragraphs?: string[],
 * }} PolicyDoc
 */

/** @type {Record<string, PolicyDoc>} */
export const POLICY_DOCS = {
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: '7 August 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        body: `We collect information you provide directly to us, such as when you create an account, place an order, or contact customer support. This may include:

- Name, email address, phone number
- Delivery and billing address
- Vehicle details you enter for fitment purposes (make, model, variant, year)
- Order history and preferences
- Communications you send us (support requests, reviews, feedback)

We also collect certain information automatically when you use the Service:

- Device and browser information
- IP address and approximate location
- Pages viewed, time spent, and site navigation patterns
- Cookies and similar tracking technologies (see Section 3)

We do not collect full payment card details — those are handled directly by our payment processor, Razorpay (see Section 4).`,
      },
      {
        heading: '2. How We Use Your Information',
        body: `We use the information we collect to:

- Process and fulfill your orders, including matching parts to your vehicle
- Communicate with you about orders, deliveries, and support requests
- Improve and personalize your experience on the Service
- Send you promotional communications, where you have opted in (you may unsubscribe at any time)
- Detect and prevent fraud, abuse, and security incidents
- Comply with legal obligations`,
      },
      {
        heading: '3. Cookies & Tracking',
        body: `We use cookies and similar technologies to keep you signed in, remember your preferences, and understand how the Service is used. You can control cookies through your browser settings; disabling cookies may limit some features of the Service (e.g. staying logged in, cart persistence).`,
      },
      {
        heading: '4. Payment Information Handling',
        body: `Payments on this Service are processed by Razorpay, a licensed payment aggregator. When you make a payment, your card, UPI, or banking details are collected and processed directly by Razorpay in accordance with Razorpay's own privacy and security practices — we do not store your full card or bank account details on our servers.

We retain a record of the transaction (amount, status, order reference, and Razorpay transaction ID) for order fulfillment, accounting, refunds, and dispute resolution purposes.`,
      },
      {
        heading: '5. Data Sharing & Third Parties',
        body: `We may share your information with:

- Delivery/logistics partners, to fulfill and ship your orders
- Razorpay, to process payments
- Service providers who help us operate the Service (e.g. hosting, customer support tools, analytics)
- Law enforcement or regulators, where required by law

We do not sell your personal information to third parties for their own marketing purposes.`,
      },
      {
        heading: '6. Data Retention',
        body: `We retain your personal information for as long as necessary to provide the Service, comply with our legal obligations (including tax and accounting requirements), resolve disputes, and enforce our agreements.`,
      },
      {
        heading: '7. Your Rights',
        body: `Depending on applicable law, you may have the right to:

- Access the personal information we hold about you
- Request correction of inaccurate information
- Request deletion of your information, subject to our legal retention obligations
- Withdraw consent for marketing communications at any time
- Lodge a complaint with the relevant data protection authority

To exercise these rights, please contact us.`,
      },
      {
        heading: "8. Children's Privacy",
        body: `The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will take steps to delete it.`,
      },
      {
        heading: '9. Data Security',
        body: `We implement reasonable technical and organizational measures to protect your personal information. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.`,
      },
      {
        heading: '10. Changes to This Policy',
        body: `We may update this Privacy Policy from time to time. We will post the updated version on this page with a revised "Last updated" date. Continued use of the Service after changes take effect constitutes acceptance of the revised policy.`,
      },
      {
        heading: '11. Contact Us',
        body: `If you have questions about this Privacy Policy or how we handle your personal information, please contact us.`,
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    lastUpdated: '7 August 2026',
    intro:
      'Welcome to CarPharmacy. These Terms & Conditions ("Terms") govern your use of our website and mobile application (together, the "Service") and your purchase of products through it. By accessing or using the Service, you agree to these Terms.',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: `By creating an account, browsing, or placing an order on the Service, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, please do not use the Service.`,
      },
      {
        heading: '2. Use of the Service',
        body: `You agree to use the Service only for lawful purposes and in accordance with these Terms. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.

You agree not to:
- Use the Service to conduct fraudulent transactions
- Attempt to gain unauthorized access to any part of the Service
- Interfere with or disrupt the operation of the Service`,
      },
      {
        heading: '3. Orders, Pricing & Payment',
        body: `- All prices are listed in Indian Rupees (INR) and are inclusive/exclusive of applicable taxes as indicated at checkout.
- We reserve the right to refuse or cancel any order, including in cases of suspected fraud, pricing errors, or unavailability of stock.
- Payments are processed securely through Razorpay. By placing an order, you authorize us (via Razorpay) to charge your selected payment method for the total order amount.
- An order is confirmed only once payment has been successfully processed and you have received order confirmation.`,
      },
      {
        heading: '4. Shipping & Delivery',
        body: `- Estimated delivery timelines are provided at checkout and are estimates only, not guarantees.
- Risk of loss and title for products pass to you upon delivery to the shipping address provided.`,
      },
      {
        heading: '5. Returns & Refunds',
        body: `Refunds, where applicable, will be issued to the original payment method via Razorpay after the returned item is received and inspected.`,
      },
      {
        heading: '6. Product Information & Fitment Disclaimer',
        body: `We make reasonable efforts to ensure that product listings, including fitment information (make, model, variant, and year compatibility), are accurate. However:

- Fitment data is provided as a guide only. You are responsible for confirming compatibility with your specific vehicle before installation, including checking VIN-specific variations where applicable.
- We are not liable for damage, malfunction, or safety issues arising from incorrect fitment selection, improper installation, or use of a part outside its intended application.
- For safety-critical components (e.g. brakes, steering, suspension), we recommend installation by a qualified mechanic.`,
      },
      {
        heading: '7. User Accounts & Responsibilities',
        body: `You must provide accurate and complete information when creating an account and placing orders. You are responsible for keeping your account information up to date and for all orders placed under your account.`,
      },
      {
        heading: '8. Limitation of Liability',
        body: `To the maximum extent permitted by applicable law, CarPharmacy shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service or products purchased through it. Our total liability for any claim shall not exceed the amount you paid for the relevant order.`,
      },
      {
        heading: '9. Governing Law & Jurisdiction',
        body: `These Terms are governed by the laws of India. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts of India.`,
      },
      {
        heading: '10. Changes to These Terms',
        body: `We may revise these Terms from time to time. Changes take effect once posted on this page with a revised "Last updated" date. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms.`,
      },
      {
        heading: '11. Contact Information',
        body: `For questions about these Terms, please contact us.`,
      },
    ],
  },
  returns: {
    title: 'Returns',
    paragraphs: [
      'We want you to be satisfied with your purchase. Eligible items may be returned in accordance with the return window and conditions stated at the time of order.',
      'Items should be unused, in original packaging where applicable, and accompanied by proof of purchase. Certain categories (e.g. electrical items once installed) may be excluded or subject to restocking fees as disclosed at checkout.',
      'To initiate a return, contact our support team with your order details. Approved returns will be processed per our refund policy.',
    ],
  },
  warranty: {
    title: 'Warranty',
    paragraphs: [
      'Warranty coverage depends on the product and manufacturer. OEM and branded parts may carry manufacturer warranties as described on the product page or included documentation.',
      'carpharmacy will assist with warranty claims for eligible products sold through our platform, in line with supplier and manufacturer policies.',
      'Warranty typically covers defects in materials or workmanship under normal use. It does not cover misuse, accident, improper installation, or normal wear unless stated otherwise.',
      'For warranty questions, contact us with your order number and a description of the issue.',
    ],
  },
}

/**
 * @param {string} kind
 * @returns {PolicyDoc | null}
 */
export function getPolicyDoc(kind) {
  return POLICY_DOCS[kind] ?? null
}

/**
 * Flatten all Terms/Privacy text for validation (no leftover bracket placeholders).
 * @param {PolicyDoc | null | undefined} doc
 */
export function policyDocPlainText(doc) {
  if (!doc) return ''
  const parts = [doc.title, doc.lastUpdated, doc.intro]
  for (const section of doc.sections ?? []) {
    parts.push(section.heading, section.body)
  }
  for (const p of doc.paragraphs ?? []) parts.push(p)
  return parts.filter(Boolean).join('\n')
}

/** Footer policy links — keep in sync with public routes in App.jsx. */
export const FOOTER_POLICY_LINKS = [
  { label: 'Privacy policy', to: '/privacy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Returns', to: '/returns' },
  { label: 'Warranty', to: '/warranty' },
]
