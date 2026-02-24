# AI Code Reviewer - Complete Setup & Run Guide

Complete step-by-step instructions to run this project locally from scratch on a new machine.

---

## Prerequisites

Before starting, ensure you have the following installed on your machine:

### Required Tools:
- **Node.js**: v18.17.0 or higher (v20+ recommended)
  - Download from: https://nodejs.org/
  - Verify: `node --version`
  
- **pnpm**: v8.0.0 or higher (or use npm/yarn as alternatives)
  - Install globally: `npm install -g pnpm`
  - Verify: `pnpm --version`
  
- **Git**: For version control (optional but recommended)
  - Download from: https://git-scm.com/

---

## Step 1: Create a New Next.js Project

Choose one method below:

### Option A: Using create-next-app (Recommended)

```bash
# Create a new Next.js project with TypeScript, Tailwind, and shadcn/ui
npx create-next-app@latest ai-code-reviewer \
  --typescript \
  --tailwind \
  --app \
  --no-eslint \
  --no-git \
  --import-alias '@/*'
```

When prompted, answer as follows:
```
✔ Would you like to use TypeScript? › Yes
✔ Would you like to use ESLint? › No
✔ Would you like to use Tailwind CSS? › Yes
✔ Would you like your code inside a `src/` directory? › No
✔ Would you like to use App Router? › Yes
✔ Would you like to use Turbopack for next dev? › Yes
✔ Would you like to customize the import alias? › No (keep default @/*)
```

Then navigate to the project:

```bash
cd ai-code-reviewer
```

### Option B: Manual Setup (Skip if you used Option A)

If you prefer manual setup, create directories manually:

```bash
mkdir ai-code-reviewer
cd ai-code-reviewer
npm init -y
```

Then install dependencies (see Step 2).

---

## Step 2: Install All Dependencies

Using pnpm (recommended):

```bash
pnpm install
```

Or using npm:

```bash
npm install
```

Or using yarn:

```bash
yarn install
```

### Core Dependencies to Install:

```bash
pnpm add \
  next@16.1.6 \
  react@19.2.4 \
  react-dom@19.2.4 \
  typescript@5.4.5 \
  tailwindcss@4.0.0-beta.1 \
  postcss@8.4.38 \
  autoprefixer@10.4.17 \
  class-variance-authority@0.7.0 \
  clsx@2.0.0 \
  tailwind-merge@2.2.2
```

### UI & Component Dependencies:

```bash
pnpm add \
  lucide-react@0.263.1 \
  @radix-ui/react-accordion@1.0.4 \
  @radix-ui/react-alert-dialog@1.0.5 \
  @radix-ui/react-dialog@1.1.1 \
  @radix-ui/react-dropdown-menu@2.0.5 \
  @radix-ui/react-tabs@1.0.4
```

### Utility Dependencies:

```bash
pnpm add \
  react-hook-form@7.50.0 \
  zod@3.22.4 \
  sonner@1.3.1 \
  next-themes@0.2.1
```

### Development Dependencies:

```bash
pnpm add -D \
  @types/node@20.10.6 \
  @types/react@18.2.46 \
  @types/react-dom@18.2.18
```

---

## Step 3: Set Up Tailwind CSS

Your project should already have Tailwind configured from create-next-app. Verify these files exist:

### Check `tailwind.config.ts`:

```bash
cat tailwind.config.ts
```

It should contain:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

### Check `postcss.config.mjs`:

```bash
cat postcss.config.mjs
```

It should contain:

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

If either file is missing, create them with the content above.

---

## Step 4: Initialize shadcn/ui Components

Initialize shadcn/ui in your project:

```bash
npx shadcn-ui@latest init
```

When prompted, answer as follows:

```
✔ Would you like to use TypeScript (recommended)? › Yes
✔ Which style would you like to use? › Default
✔ Which color would you like as the base color? › Slate
✔ Where is your global CSS file? › app/globals.css
```

This will update your `components.json` file.

---

## Step 5: Add shadcn/ui Components

Install the specific shadcn/ui components used in this project:

```bash
npx shadcn-ui@latest add accordion
npx shadcn-ui@latest add alert-dialog
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add input
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add textarea
```

---

## Step 6: Project File Structure

Ensure your project structure looks like this:

```
ai-code-reviewer/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    ← Main AI Code Reviewer page
├── components/
│   ├── ui/                         ← shadcn/ui components (auto-generated)
│   │   ├── accordion.tsx
│   │   ├── alert-dialog.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── tabs.tsx
│   │   ├── textarea.tsx
│   │   └── ... (other components)
│   └── theme-provider.tsx
├── hooks/
│   └── use-mobile.ts
├── lib/
│   └── utils.ts
├── public/
│   └── ... (favicon, images, etc.)
├── .env.local                      ← Create this (see Step 7)
├── components.json
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## Step 7: Environment Variables (Optional)

Create a `.env.local` file in the project root if you need environment variables:

```bash
touch .env.local
```

Add any environment variables (currently, this project doesn't require any for basic functionality):

```env
# Example - not required for this project
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Step 8: Update `app/layout.tsx`

Ensure your `app/layout.tsx` has the correct setup. It should look like:

```typescript
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'] })
const geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Code Reviewer',
  description: 'Intelligent code review with AI-powered insights',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

---

## Step 9: Add the Main Page Component

Copy the main page component to `app/page.tsx`. This file should contain the AI Code Reviewer UI with:

- Input section (file upload, prompt, review options)
- Results section (severity cards, file accordions, issues)
- Mock data for demonstration
- Dark theme styling

The file uses:
- `lucide-react` for icons
- Tailwind CSS for styling
- React hooks for state management
- shadcn/ui components

---

## Step 10: Verify Configuration Files

Ensure these configuration files are present and correctly set up:

### `tsconfig.json` - Should have:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForEnumMembers": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### `next.config.mjs` - Should have:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {}

export default nextConfig
```

### `components.json` - Should have:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "aliasPrefix": "@",
  "resolvedPaths": {
    "utils": "./lib/utils",
    "components": "./components"
  }
}
```

---

## Step 11: Start the Development Server

Run the development server:

```bash
pnpm dev
```

Or with npm:

```bash
npm run dev
```

Or with yarn:

```bash
yarn dev
```

Expected output:

```
  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Environments: .env.local
```

---

## Step 12: Open in Browser

Open your browser and navigate to:

```
http://localhost:3000
```

You should see the AI Code Reviewer UI with:
- Dark theme background
- File upload area
- Review options (Full, Bug Detection, Security, Performance, Style, Architecture)
- Results panel showing mock code review data

---

## Troubleshooting

### Issue: "Cannot find module 'lucide-react'"

**Solution:**
```bash
pnpm add lucide-react
```

### Issue: "Module not found: Can't resolve '@/components/ui/...'"

**Solution:** Ensure all shadcn/ui components are installed:
```bash
npx shadcn-ui@latest add accordion
npx shadcn-ui@latest add alert-dialog
npx shadcn-ui@latest add button
# ... etc
```

### Issue: Port 3000 is already in use

**Solution:** Run the dev server on a different port:
```bash
pnpm dev -p 3001
```

Then visit `http://localhost:3001`

### Issue: Tailwind CSS styles not applying

**Solution:** 
1. Clear Next.js cache: `rm -rf .next`
2. Restart dev server: `pnpm dev`
3. Ensure `app/globals.css` is imported in `app/layout.tsx`

### Issue: "Could not find a valid build in the '.next' directory"

**Solution:**
```bash
rm -rf .next
pnpm dev
```

---

## Useful Commands

```bash
# Development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code (if ESLint is configured)
pnpm lint

# Format code with Prettier (if configured)
pnpm format

# Type check
pnpm type-check
```

---

## Summary

You now have a fully functional AI Code Reviewer Next.js application running locally!

**Quick Recap:**
1. ✅ Node.js and pnpm installed
2. ✅ Next.js project created with TypeScript and Tailwind
3. ✅ All dependencies installed
4. ✅ Tailwind CSS configured
5. ✅ shadcn/ui initialized and components added
6. ✅ Environment variables set up (if needed)
7. ✅ Project files in correct structure
8. ✅ Dev server running on http://localhost:3000

---

## Next Steps

- **Customize the theme:** Edit `app/globals.css` to change colors
- **Modify the UI:** Edit `app/page.tsx` to adjust components
- **Add real backend:** Connect to an actual AI service (OpenAI, Anthropic, etc.)
- **Deploy:** Use `vercel deploy` or push to GitHub for CI/CD

---

## Support

For issues with:
- **Next.js:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com/
- **Lucide Icons:** https://lucide.dev/

---

**Happy coding!** 🚀
