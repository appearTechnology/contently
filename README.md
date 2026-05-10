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

## Clerk: `POST /client/sign_ups` returns 422

That response is from **Clerk’s Frontend API** (validation or instance policy), not from this repo’s API routes.

1. **See the real reason:** DevTools → **Network** → filter `sign_ups` → open the failed **POST** → **Response** / **Preview** → copy the JSON (`errors`, `long_message`, etc.).
2. **Typical fixes:** password policy, duplicate email, blocked/disposable email (Dashboard → **Restrictions**), or **Attack Protection** / bot challenge failing in dev (relax or fix ad blockers; check Clerk logs).
3. **Env:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` must be from the **same** Clerk app. Paths in `.env.example` must match your routes (`/sign-in`, `/sign-up`).
4. **App Router catch-all:** `<SignUp />` / `<SignIn />` are mounted with `path` + `routing="path"` in [`components/clerk-sign-up-panel.tsx`](components/clerk-sign-up-panel.tsx) and [`components/clerk-sign-in-panel.tsx`](components/clerk-sign-in-panel.tsx) so Clerk’s client matches `[[...sign-up]]` / `[[...sign-in]]`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [Figtree](https://fonts.google.com/specimen/Figtree) for UI, headings, and monospace-styled text.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
