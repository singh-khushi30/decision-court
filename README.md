# Decision Court

A multi-agent decision-analysis system that uses adversarial reasoning, evidence evaluation, and human context to help users examine difficult decisions from multiple perspectives.

**This project is under development.** The repository currently contains the technical foundation only.

## Project concept

Decision Court helps a person slow down a difficult choice and inspect it from more than one side. The user describes the decision. Separate agents then argue for it, argue against it, test the assumptions in those arguments, weigh the evidence and the uncertainty, and produce a balanced decision report. The report also names the factors that would change the verdict.

## Planned architecture

The product will be a Next.js web app backed by a LangGraph.js workflow:

1. The user submits a decision and any context they already have.
2. An Advocate builds the strongest case for the decision.
3. A Challenger builds the strongest case against it.
4. The agents challenge assumptions and arguments on both sides.
5. An evaluator examines the evidence and the remaining uncertainty.
6. A Judge writes a balanced decision report.
7. The system explains which factors would change the verdict.

Those roles will live under `src/lib/agents`, with shared model setup in `src/lib/ai`, validation schemas in `src/lib/schemas`, and shared TypeScript types in `src/types`. UI will be built later with the shadcn components in `src/components/ui`.

None of that workflow is implemented yet.

## Tech stack

- Next.js (App Router) and React
- TypeScript
- Tailwind CSS
- shadcn/ui (CSS variables, base-nova)
- Motion
- LangGraph.js and `@langchain/google-genai`
- Zod
- React Hook Form
- Recharts
- Lucide React
- Vitest, React Testing Library, and jsdom
- ESLint
- npm

The intended deployment target is Vercel.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm test
npm run test:watch
npm run lint
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values locally. `.env.local` is gitignored. Do not commit API keys.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | API key for the Gemini model provider |
| `GEMINI_MODEL` | Gemini model name the agents will use |

The Gemini client is not wired up yet. Tests do not call Gemini or any other external API.

## Current development status

In place:

- Next.js App Router application with TypeScript, Tailwind CSS, and ESLint
- shadcn/ui initialized with a small base component set
- Runtime dependencies for animation, agent orchestration, forms, charts, and icons
- Folders reserved for future AI, agent, schema, and type code
- Vitest smoke test
- Environment variable template

Still ahead: the product interface, agent workflows, the Gemini integration, authentication, and a database.
