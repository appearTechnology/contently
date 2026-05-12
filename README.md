This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## AI Gateway

This app calls models through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) using `provider/model` strings in `lib/models/registry.ts`.

1. Link the project: `vercel link`
2. Enable AI Gateway for the project in the Vercel dashboard
3. Pull environment variables: `vercel env pull .env.local` (provisions `VERCEL_OIDC_TOKEN` for local development; refresh when it expires)

Alternatively set `AI_GATEWAY_API_KEY` in `.env.local` (see `.env.example`).

## Supabase Auth (password + magic link)

Sign-in supports **email + password** and **email magic links** via [Supabase Auth](https://supabase.com/docs/guides/auth/passwords) and [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/nextjs). Registration uses **`/sign-up`** (email + password).

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. Set `NEXT_PUBLIC_SITE_URL` to your deployed origin (no trailing slash), e.g. `https://your-app.vercel.app`. For local dev, `http://localhost:3000` is fine.
3. In the Supabase dashboard: **Authentication → Providers → Email** — enable **Confirm email** / password sign-up as needed, and magic links or OTP if you use the magic-link tab.
4. Under **URL configuration**, add **Redirect URLs** that include `{NEXT_PUBLIC_SITE_URL}/auth/callback` (and the same for localhost while developing).

`proxy.ts` refreshes the session cookie; dashboard routes and API handlers call `getUser()` / `getAuthenticatedUserId()` for authorization. Onboarding completion is stored in **`user_metadata.onboardingComplete`**.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you modify the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [Figtree](https://fonts.google.com/specimen/Figtree) for UI, headings, and monospace-styled text.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
