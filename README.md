# Receipt Parser

## What did you build?

I built a full-stack, local-first receipt parsing pipeline that turns image uploads into structured data. The backend is an Express/TypeScript REST API backed by a local SQLite Database configured in WAL-mode for resilience. It features a robust, provider-agnostic LLM orchestration layer that attempts extraction via Gemini 2.5 Flash, and seamlessly falls back to Anthropic Claude Haiku in the event of schema validation failures or network errors. Image uploads are automatically normalized (resized, rotated, and compressed) via Sharp to optimize token and bandwidth costs, and deduplicated using SHA-256 hashing to prevent duplicate API billing. The frontend is a clean, dependency-free Vanilla TypeScript Single Page Application (SPA), emphasizing a "correction-first" UX. It surfaces LLM-extracted data alongside confidence indicators, automatically detects mismatches between calculated line-item sums and the stated receipt total, and caches user edits.

## What are the biggest tradeoffs you made, and why?

1. **No-Framework Vanilla Frontend vs. React/Vue:** I decided to build the frontend as a pure TypeScript SPA using a lightweight Controller + DOM DOM factory pattern. *Why:* For a prototype focused specifically on UI correction UX, dragging in a heavy Virtual DOM framework and complex build toolchain felt like over-engineering constraint. Vanilla TS ensures maximum performance and zero dependency overhead, while still allowing for strict typing between the backend Zod schemas and frontend.
2. **Synchronous SQLite vs. Async Postgres:** I opted for `better-sqlite3` running completely synchronously. *Why:* Unlike Node pipelines involving heavy network I/O, SQLite is embedded. Asynchronous SQLite wrappers often introduce unnecessary Promise overhead for local disk reads. By enabling WAL (Write-Ahead Logging) mode, `better-sqlite3` behaves as a high-performance, concurrent transactional datastore without the operational overhead of spinning up a Dockerized Postges instance.
3. **Primary-Fallback LLM Strategy over Single Heavy Model:** Instead of sending all receipts to a single, expensive "smart" model (like GPT-4V or Claude 3.5 Sonnet), I chose Gemini 2.5 Flash as the primary parser. *Why:* It's incredibly fast and aggressively priced. To handle its occasional hallucinations, I wrapped the parser in an Orchestrator that validates output strictly against a Zod schema. If Gemini fails, it triggers Anthropic Claude Haiku. This optimizes for cost/latency on 90% of requests, while preserving reliability for the 10% edge cases.

## Where did you use an LLM, and for what?

I heavily utilized LLMs (like Claude through an agentic assistant) as a pair-programming partner during this assignment:

- **Architecture and scaffolding:** Brainstorming the project structure and drafting the initial TypeScript boilerplate.
- **Prompt Engineering:** Iterating on the system instructions for the Vision providers to ensure the models output pure, parse-able JSON without Markdown wrappers.
- **CSS Design:** Translating my design concepts (Clean, minimal light theme, glassmorphism) into a working CSS Custom Properties system.

## What would you do with another week?

1. **Decoupled OCR vs NLP Parsing:** Right now, the LLM is doing both Optical Character Recognition (reading the pixels) and Natural Language Processing (understanding the receipt structure). With more time, I would insert a traditional, cheap OCR layer (like Tesseract.js or AWS Textract) to extract the raw text, and *only* pass text to the LLM to structure. This drastically limits hallucination risks and minimizes latency.
2. **Fuzzy Search & Analytics UI:** I'd expand the History view into an expense dashboard, allowing users to query expenditures by category or merchant using Full Text Search (FTS5) in SQLite.
3. **Frontend E2E Testing:** With the correction UX being paramount, relying on manual clicks is risky. I'd add Playwright tests to simulate a user uploading an image, purposely modifying the extracted total to create a mismatch, and verifying the warning banners behave appropriately.

## What's one thing in this spec you'd push back on if I were your PM?

**I would push back strongly on the implicit requirement that "Line Items" are universally required or primary to user value.**
While line items are interesting technically, users capturing receipts structurally care overwhelmingly about three numbers: `Subtotal`, `Tax`, and `Total` (for expensing or accounting purposes). Asking the OCR or the LLM to meticulously parse line items on crumpled, localized receipts with hand-written modifications often introduces a cascading series of noisy errors.
Furthermore, providing users a UX where they must manually correct poorly-parsed line items just so the `Sum(Line Items) = Total` validation passes is a deeply frustrating user experience. Unless this application is explicitly designed for an itemized splitting use-case (like Splitwise), I would advise the PM that we should demote Line Items to an *optional/collapse-by-default* extraction, and instead prioritize the reliable extraction of the Tax, Tip, and Date triad.
