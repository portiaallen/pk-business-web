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

## Contact Form Email

Consultation requests are emailed to **portiaallen40@gmail.com** using your Gmail account (no Resend or other email service required).

### Why a password is still required

Websites cannot send email on their own. Vercel runs the form handler, but something must authenticate with Gmail's servers. That is a one-time **Google App Password** — not your normal Gmail login.

### Setup (one time)

1. Turn on **2-Step Verification** for portiaallen40@gmail.com
2. Create an **App Password**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Copy the 16-character password

### Local development

```bash
cp .env.example .env.local
# Add GMAIL_APP_PASSWORD to .env.local
npm run dev
```

### Vercel

Project → **Settings** → **Environment Variables**:

| Variable | Value |
| -------- | ----- |
| `GMAIL_USER` | `portiaallen40@gmail.com` |
| `GMAIL_APP_PASSWORD` | Your Google App Password |
| `CONTACT_EMAIL` | `portiaallen40@gmail.com` |

Redeploy after saving. Form submissions will arrive in your Gmail inbox with the visitor's email as Reply-To.

## License

Private — PK Business Services.
