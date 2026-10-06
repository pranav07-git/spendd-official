/**
 * Spendd's Privacy Policy and Terms of Use, shown in the app (LegalScreen). Written to match what
 * the app actually does; update both whenever data handling changes, and have them reviewed by a
 * lawyer before release.
 */

/** Where users write about privacy, grievances and these terms. Fill in before release. */
export const LEGAL_CONTACT_EMAIL = 'anshultrip123@gmail.com';
export const LEGAL_UPDATED = '6 October 2026';

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type LegalDocument = { title: string; intro: string; sections: LegalSection[] };

export type LegalDoc = 'privacy' | 'terms';

const privacy: LegalDocument = {
  title: 'Privacy Policy',
  intro:
    'Spendd helps you see where your money goes. This policy explains what Spendd uses, where it is kept, what leaves your phone, and the choices you have. It follows India’s Digital Personal Data Protection Act, 2023.',
  sections: [
    {
      heading: 'What Spendd uses',
      bullets: [
        'Payment screenshots you choose to share with Spendd. They are read on your phone and deleted once read.',
        'What is read from them: amount, date and time, the payee’s name and UPI ID, bank, and reference number.',
        'Payments you add or edit yourself, your categories, your budget, and your name and profile choices.',
        'Your app PIN, kept in your phone’s secure keystore. Fingerprint unlock uses your phone’s own biometric system.',
      ],
    },
    {
      heading: 'What Spendd does not use',
      bullets: [
        'Your SMS, contacts, photo gallery, location or bank login details.',
        'Any screenshot you have not shared with Spendd yourself.',
      ],
    },
    {
      heading: 'Where your data is kept',
      paragraphs: [
        'Your transactions, screenshots and settings are stored only on your phone, in storage other apps cannot read. Spendd does not keep a copy of your transaction list on any server.',
      ],
    },
    {
      heading: 'What leaves your phone',
      paragraphs: [
        'To write your insights and sort new shops into categories, Spendd sends a small amount of information to the Spendd server, which uses Google Gemini to answer:',
      ],
      bullets: [
        'Monthly figures: totals, category totals and changes, and the names of businesses you paid.',
        'For a business Spendd hasn’t seen before: its name, its UPI ID, the payment rounded to the rupee, and the hour it was made.',
        'Never: your screenshots, your full transaction list, your PIN, or the names or UPI IDs of people you pay.',
      ],
    },
    {
      heading: 'How that information is handled',
      bullets: [
        'It is sent over an encrypted connection and used only to answer that request.',
        'A business’s category (for example “Swiggy → Food”) is remembered on the server so the next person paying it gets an answer faster. This record holds no details about you.',
        'Google processes the request as our service provider under its terms for the Gemini API.',
        'Spendd does not sell your data, share it with advertisers, or use it to decide credit or lending.',
      ],
    },
    {
      heading: 'How long it is kept',
      paragraphs: [
        'Data on your phone stays until you delete it: delete a payment, clear all transactions, or reset Spendd in Profile. Uninstalling Spendd removes it too. The server keeps request logs only as long as needed to run and secure the service.',
      ],
    },
    {
      heading: 'Your rights',
      bullets: [
        'See and correct your data: every payment can be opened and edited in the app.',
        'Export it: Profile → Export transactions.',
        'Erase it: Profile → Clear all transactions, or Reset Spendd.',
        'Withdraw consent: reset Spendd, or uninstall it. Withdrawing doesn’t affect what was done before.',
        'Raise a grievance or nominate someone to act for you by writing to us.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: ['Spendd is meant for people aged 18 and over.'],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If this policy changes in a way that matters, Spendd will tell you in the app before the change applies.',
      ],
    },
    {
      heading: 'Contact and grievances',
      paragraphs: [
        `Write to ${LEGAL_CONTACT_EMAIL}. We aim to reply within 7 days and resolve grievances within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.`,
      ],
    },
  ],
};

const terms: LegalDocument = {
  title: 'Terms of Use',
  intro: 'These terms apply when you use Spendd. By tapping “Allow and continue”, you agree to them.',
  sections: [
    {
      heading: 'What Spendd is',
      paragraphs: [
        'Spendd is a personal spending tracker. It reads payment screenshots you share, organises your spends, and shows insights. It does not move money, connect to your bank account, or make payments.',
      ],
    },
    {
      heading: 'Who can use it',
      paragraphs: ['You must be 18 or older and use Spendd for your own personal spending.'],
    },
    {
      heading: 'Not financial advice',
      paragraphs: [
        'Insights, forecasts, daily budgets and categories are estimates to help you think about your money. They are not financial, tax, investment or legal advice. Check important decisions with a qualified professional.',
      ],
    },
    {
      heading: 'Accuracy',
      paragraphs: [
        'Spendd reads screenshots automatically and can misread amounts, dates or names, or place a payment in the wrong category. Review your payments and correct them in the app. Your bank’s records are always the source of truth.',
      ],
    },
    {
      heading: 'Your responsibilities',
      bullets: [
        'Only share screenshots of your own payments.',
        'Keep your phone and Spendd PIN secure. Anyone who can unlock Spendd can see your spending.',
        'Don’t misuse Spendd, try to break its security, or overload or interfere with the Spendd server.',
      ],
    },
    {
      heading: 'Spendd',
      paragraphs: [
        'Some features use Google Gemini through the Spendd server, as explained in the Privacy Policy. AI-written text can be wrong; the numbers in it come from your own payments.',
      ],
    },
    {
      heading: 'Availability',
      paragraphs: [
        'Spendd is provided as it is. We work to keep it running but can’t promise it will always be available or error-free, and features may change.',
      ],
    },
    {
      heading: 'Liability',
      paragraphs: [
        'To the extent the law allows, Spendd is not liable for losses from relying on its insights, from misread or miscategorised payments, or from someone else using your unlocked phone.',
      ],
    },
    {
      heading: 'Ending use',
      paragraphs: [
        'You can stop using Spendd at any time by resetting it in Profile or uninstalling it. We may suspend access to the Spendd server if these terms are broken.',
      ],
    },
    {
      heading: 'Changes and law',
      paragraphs: [
        'We may update these terms and will tell you in the app before important changes apply. These terms are governed by the laws of India.',
        `Questions: ${LEGAL_CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDoc, LegalDocument> = { privacy, terms };
