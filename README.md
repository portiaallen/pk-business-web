# PK Business Services 2.0

A professional, responsive website for **PK Business Services** — bookkeeping, QuickBooks support, financial documentation, and business support for small businesses and self-employed professionals.

## Features

- **Home** — Hero, service overview, how-it-works, trust section, and consultation CTA
- **Services** — Detailed service pages for all four offerings
- **About** — Company positioning and core principles
- **Contact** — Consultation request form with client-side validation

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- TypeScript
- Tailwind CSS v4
- [shadcn/ui](https://ui.shadcn.com/) components

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start development server |
| `npm run build` | Production build         |
| `npm run start` | Start production server  |
| `npm run lint`  | Run ESLint               |

## Project Structure

```
src/
├── app/              # Pages and layouts
├── components/       # Reusable UI components
│   ├── forms/        # Consultation form
│   ├── layout/       # Header, Footer, Section
│   ├── sections/     # Homepage sections
│   └── ui/           # shadcn/ui primitives
└── content/          # Site copy and service data
```

## Contact Form Integration

The consultation form includes client-side validation and a clearly marked integration point in `src/components/forms/ConsultationForm.tsx`. To connect email delivery or a backend API, replace the demo handler in `handleSubmit` with your preferred service (e.g., Resend, SendGrid, or a Next.js API route).

## License

Private — PK Business Services.
