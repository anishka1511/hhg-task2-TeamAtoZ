# Your role (Member 3) — plain English

You’re responsible for **how the product looks**, **how people use it in the browser**, and **the videos + social posts**. You’re **not** responsible for the AI brain, the database, speech API setup, or putting the site online.

The other two build a working system first (even if it looks basic). You make it look good and handle the promo requirements. If you’re delayed, they can still submit with their simple version — so **don’t block them**, and **don’t reopen technical decisions**.

## What you should do

### 1. Build / polish the website UI
Make a clean one-page demo that includes:
- Title and short description
- A **text box** to type a question (required)
- A **mic button** to speak a question
- A place to show: the answer, retrieved snippets, timing chips, and a clear message if the system **refuses**

Also handle: waiting, recording, loading, errors (mic blocked, network failed, refused).

It should look fine on **phone and laptop**.

### 2. Work from the agreed API (or fake data first)
Call only:
- `GET /api/health`
- `POST /api/stt`
- `POST /api/query`

**Day 1:** use mocks in `frontend/mocks/` (`NEXT_PUBLIC_USE_MOCKS=true`).  
**Later:** point at the real API with `NEXT_PUBLIC_API_URL`.

Do **not** invent new backend routes or add random SDKs without asking Builder 2.

### 3. Write a short demo script
60–90 seconds:
1. Open the live site  
2. Type a normal question → good answer + snippets  
3. Ask something off-topic → refusal  
4. Optional: one voice question  

### 4. Videos + social posts (mandatory)
Help with:
- **Video 1 (~90s):** team working / process  
- **Video 2:** product working end to end  

Every team member posts **both** videos on Instagram, X, and LinkedIn.  
Every post must include **`#RAGInGoa`**.  
At least **one Instagram** account must be public.  
That’s **18 posts** total — use the checklist in `docs/PROMO_CHECKLIST.md`.

### 5. Small README help
Write a short “How to try the demo” section. A builder will approve it once.

## What you should NOT do
- Set up or debug Sarvam / API keys  
- Work on chunking, embeddings, or Qdrant  
- Change LLM prompts or guardrail logic  
- Own latency measurements  
- Handle deployment  
- Suggest Chrome STT / Deepgram / ElevenLabs / LightRAG — **already decided: no**

Ask questions only when **blocked** (API mismatch, live URL down). Don’t turn every decision into a long discussion.

## Done means
- UI looks submission-ready and works with mocks or the real API  
- Demo script is ready  
- Video/social checklist is complete  
- No secrets committed  
- You didn’t block the other two from shipping  

**Bottom line:** make it look good, make the demo easy to record, and nail the promo posts. Leave the heavy AI/backend work to the other two.
