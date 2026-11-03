# Decision Court

Decision Court uses a structured adversarial reasoning prompt to help a person examine a difficult decision from more than one side. It does not choose for them.

## Architecture

```
Decision input
     ↓
One Gemini request
     ↓
Raw JSON
     ↓
Deterministic JSON parser
     ↓
Zod validation
     ↓
Decision report
```

One request asks the configured Gemini model for the whole report: the case for, the case against, challenged assumptions, unresolved questions, evidence dimensions, a verdict, confidence, a bottom line, for and against points, key insights, what would change the verdict, next steps, and a summary. Those sections stay in the report. They are written in that single response.

The model returns ordinary JSON. Decision Court does not send a response schema. A deterministic parser accepts a JSON object, including one surrounding code fence, and rejects prose mixed with JSON. Existing Zod schemas check scores, lengths, required sections, and controlled values. The parsed sections are assembled into the same report the interface already shows.

A fast provider 503 may be tried once more when the shared deadline still has time for a short wait and another call. That retry uses the time still left. It does not start a new deadline. Authentication failures, invalid requests, unknown models, rate limits, malformed JSON, schema failures, and timeouts are not retried.

Adversarial reasoning is in the prompt so a fluent argument does not get the last word. The report states competing arguments, assumptions, uncertainty, missing information, and practical next steps. It does not say what the person should definitely do.

Analysis confidence is how complete and well-supported the analysis is given what was supplied. It is not the probability that a choice will succeed. Dimension scores are indicators, not scientific probabilities, and the verdict is not an average of those scores.

## Privacy

The decision and context are sent to Gemini for that analysis only. There is no database, no analytics, and no server-side copy. The server does not log the decision, the context, the prompts, or the model response. The finished report is stored in `sessionStorage` in the browser tab. Refreshing the tab can keep it. Closing the session can remove it.

## Limits

The analysis has one 40 second deadline and an output ceiling of about 3500 tokens. A fast 503 may use one short retry inside that same deadline. Malformed or schema-invalid JSON is rejected without another model call.

`POST /api/decision/analyze` also applies an in-memory limit of 5 analyses per 10 minutes per client address. That limiter is best-effort for a single server process. It is not a distributed production rate limiter and resets when the process restarts.

Prepared examples remain available at `/analysis/demo` and `/verdict/demo`. They do not call Gemini.

## Tech stack

- Next.js (App Router) and React
- TypeScript
- Tailwind CSS
- shadcn/ui (CSS variables, base-nova)
- Motion
- `@langchain/google-genai`
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
npm run test:gemini
```

`npm run test:gemini` makes one small real Gemini call with the same client configuration as the app. It is not part of `npm test` or `npm run build`. Restart `npm run dev` after changing `.env.local`, because Next reads environment variables when the server starts.

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values locally. `.env.local` is gitignored. Do not commit API keys.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | API key for the Gemini model provider |
| `GEMINI_MODEL` | Optional Gemini model name. When empty, the server uses `gemini-3.8-flash`. |

`GEMINI_API_KEY` is read only on the server. Automated tests mock the provider and do not call Gemini.

## Current limitations

- No accounts, saved history, or shared reports
- No web search or document retrieval
- The analysis screen shows the shape of the review, not live model progress
- The in-memory rate limit does not coordinate across multiple servers
- The analysis has one 40 second deadline. A slow response can use that whole budget.
