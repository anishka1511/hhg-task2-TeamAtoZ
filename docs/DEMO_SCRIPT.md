# 🎬 Demo & Video Guide — Team AtoZ (HH Goa 2026 Task 2)

This document provides the step-by-step recording scripts and checklists for both submission videos required by the HH Goa 2026 task.

---

## 📹 Video 1 — Team & Process Video (90 Seconds)

**Goal:** Showcase how Team AtoZ collaborated and engineered the solution (process, not the final product).

| Timestamp | Speaker / Focus | Visual & Action | Talking Points |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:20** | **Team Intro & Problem** | Screen showing architecture diagram / team chat / GitHub | *"Hi! We are Team AtoZ for HH Goa 2026 Task 2. Our mission was to build an ultra-fast, voice-enabled RAG pipeline targeting sub-200ms end-to-end latency on the MSMARCO-XI dataset."* |
| **0:20 – 0:45** | **Builder 1 (Knowledge Layer)** | Terminal / Qdrant UI / `indexing/` code | *"Builder 1 tackled the knowledge layer: ingesting MSMARCO-XI and implementing 3 chunking strategies—fixed overlap, semantic boundary splitting, and metadata-aware indexing to balance retrieval speed and precision."* |
| **0:45 – 1:10** | **Builder 2 (Pipeline & Harness)** | Backend logs / Fastify server / Benchmark scripts | *"Builder 2 built the orchestration harness: integrating Sarvam STT, Fastify query pipelines, grounded LLM generation, strict guardrails against hallucination, and rigorous P50/P70/P100 latency benchmarks."* |
| **1:10 – 1:30** | **Member 3 (UI, UX & Promo)** | Next.js frontend / Git workflow / Social tracker | *"Member 3 built the responsive dark-mode UI with live audio waveforms, real-time latency analytics HUD, and context inspector, while managing our promo rollout. Let's look at the live demo!"* |

---

## 💻 Video 2 — End-to-End Product Demo (60–90 Seconds)

**Goal:** Clean, comprehensive demonstration of the working product on the live web UI.

### Step-by-Step Script:

#### 1. Setup & Overview (0:00 – 0:15)
* **Action:** Open the live frontend at `http://localhost:3000` (or live Vercel URL).
* **Narration:** 
  > *"Welcome to Team AtoZ's Voice-Enabled RAG system. Our app features multi-strategy chunking, Sarvam speech-to-text, Qdrant vector retrieval, real-time guardrails, and latency instrumentation designed to stay under 200ms."*

#### 2. Happy Path: Grounded Text Query (0:15 – 0:40)
* **Action:** Select **`Fixed Overlap`** strategy $\to$ Click prompt chip **`📍 Paris (MSMARCO)`** (or type question) $\to$ Press **Ask**.
* **Narration:**
  > *"First, let's ask a grounded question: 'What is Paris and what country is it the capital of?' Notice how fast it responds. We receive a concise, grounded answer. Below, our Latency HUD shows the exact breakdown across STT, Qdrant retrieval, generation, and guardrails—completing well under our 200ms target. Expanding our context cards reveals the exact MSMARCO chunks and cosine similarity scores."*

#### 3. Guardrail Refusal Demonstration (0:40 – 0:60)
* **Action:** Click prompt chip **`🛡️ Weather (Guardrail Test)`** (*"What is the current weather forecast in Tokyo today?"*) $\to$ Press **Ask**.
* **Narration:**
  > *"Next, let's test our guardrails with an ungrounded, off-topic query. Instead of hallucinating, our guardrail harness immediately detects the lack of context and safely refuses with a clear alert. Our system knows when not to answer."*

#### 4. Voice Input Query via Sarvam STT (0:60 – 0:85)
* **Action:** Select **`Semantic Splitting`** strategy $\to$ Click the **Microphone button** 🎙️ $\to$ Speak a question $\to$ Stop recording.
* **Narration:**
  > *"Finally, let's test our voice pipeline. We tap the mic button—you see the live waveform animation—speak our question, and tap stop. The audio is transcribed via Sarvam STT and routed through our semantic retrieval pipeline instantly."*

#### 5. Conclusion & Submission Signoff (0:85 – 0:90)
* **Narration:**
  > *"That is our end-to-end Voice-Enabled RAG pipeline for HH Goa 2026. Built by Team AtoZ!"*

---

## 📋 Promotion Checklist Reference
All 3 team members must upload both videos to:
* 📷 **Instagram** (At least 1 account public)
* 🐦 **X (Twitter)**
* 💼 **LinkedIn**
* Tag every post with **`#RAGInGoa`**

Track progress in [`docs/PROMO_CHECKLIST.md`](./PROMO_CHECKLIST.md).
