---
theme: default
title: Andrea — Small claims, clearer next steps
info: |
  A short presentation about responsible GenAI support for self-represented
  persons preparing Small Claims Tribunal claims.
author: Andrea team
aspectRatio: 16/9
canvasWidth: 1280
colorSchema: light
drawings:
  persist: false
transition: fade-out
css: unocss
---

<div class="problem-layout">
  <div class="problem-copy">
    <div class="kicker">The problem · SRPs + GenAI</div>
    <h1>Generic AI is not designed for the SCT process.</h1>
    <p class="lede">A helpful-sounding answer can still leave a self-represented person less prepared.</p>
    <div class="question">How might GenAI become a responsible preparation tool—not an unreliable shortcut?</div>
  </div>

  <div class="risk-panel">
    <div class="risk-panel-title">Where generic AI can go wrong</div>
    <div class="risk-card">
      <div class="risk-number">01</div>
      <div><h3>Important gaps stay hidden</h3><p>Relevant facts or supporting documents may never be surfaced.</p></div>
    </div>
    <div class="risk-card">
      <div class="risk-number">02</div>
      <div><h3>Assumptions get reinforced</h3><p>The system may agree with the user instead of testing their account.</p></div>
    </div>
    <div class="risk-card">
      <div class="risk-number">03</div>
      <div><h3>Confident errors feel credible</h3><p>Hallucinated or outdated information can sound authoritative.</p></div>
    </div>
  </div>
</div>

<DeckFooter page="01" />

<!--
Good afternoon everyone, our team’s project focuses on self-represented persons, or SRPs, using GenAI to prepare Small Claims Tribunal claims.

The problem is that generic AI may answer a legal question, but it is not necessarily designed around the specific SCT process.

This creates risks: users may miss important facts or evidence, receive inaccurate information, or have their existing assumptions reinforced by the AI.

So we asked: how can we make GenAI a more responsible and useful preparation tool for SRPs?
-->

---

<div class="scenario-head">
  <div>
    <div class="kicker">The scenario · anonymised SCT facts</div>
    <h1>Imagine this was<br>your grandmother.</h1>
    <p class="lede">An elderly Mandarin-speaking woman sees “<strong>S&#36;30 haircut for women</strong>”—and says she was pressured into an upgraded package.</p>
  </div>
  <div class="scenario-badge">Toa Payoh · 23 Oct 2025</div>
</div>

<div class="scenario-grid">
  <section class="scenario-profile">
    <div class="scenario-profile-label">The claimant</div>
    <h2>She was Chinese-educated, spoke primarily Mandarin and understood very little English.</h2>
    <div class="scenario-profile-facts">
      <span><b>Purpose</b> Obtain a simple haircut</span>
      <span><b>Setting</b> A neighbourhood outlet in Toa Payoh</span>
      <span><b>Her account</b> She felt “pressured”, “frightened” and “afraid”</span>
    </div>
  </section>

  <div class="scenario-story">
    <div class="scenario-timeline">
      <article class="scenario-step"><span>01</span><h3>What she expected</h3><p>A simple women’s haircut advertised at S&#36;30.</p></article>
      <article class="scenario-step"><span>02</span><h3>What she was told</h3><p>The consultants initially represented that a basic haircut package would cost S&#36;30.</p></article>
      <article class="scenario-step"><span>03</span><h3>What she was charged</h3><p>After the service, the store charged S&#36;100 for an upgraded haircut, hairwash and treatment package.</p></article>
      <article class="scenario-step"><span>04</span><h3>What happened next</h3><p>Her daughter said she had been “scammed”. She sought a refund the next day, then approached the police, CASE and the SCT.</p></article>
    </div>
    <div class="scenario-outcome"><strong>The question</strong><span>How do we translate “I was pressured” into a cause of action?</span></div>
  </div>
</div>

<DeckFooter page="02" />

<!--
To make the problem concrete, imagine this claimant was your own grandmother.

She was elderly and Chinese-educated, spoke primarily Mandarin and understood very little English. On 23 October 2025, she visited a neighbourhood outlet in Toa Payoh for a simple haircut after seeing a sign advertising a thirty-dollar women’s haircut.

The consultants initially represented that a basic haircut package would cost twenty dollars. After the service, however, she was charged one hundred dollars for an upgraded package comprising a haircut, hairwash and hair treatment.

At home, her daughter told her she had been scammed. She returned the next day to seek a refund and, when no agreement was reached, approached the police, CASE and eventually the SCT.

Her position was that she had felt pressured, frightened and afraid during the sales process. That gives Andrea an important starting question: what facts and evidence support that conclusion?
-->

---

<div class="intro-grid">
  <div class="intro-copy">
    <div class="wordmark"><span class="wordmark-mark">A</span> Andrea</div>
    <div class="kicker">A guided preparation companion</div>
    <h1>From a story<br>to an organised case.</h1>
    <p class="intro-subtitle">Andrea turns an overwhelming account into a sequence the user can work through.</p>
    <div class="flow-rail">
      <span class="flow-step">Understand</span><span class="flow-arrow">→</span>
      <span class="flow-step">Clarify</span><span class="flow-arrow">→</span>
      <span class="flow-step">Identify</span><span class="flow-arrow">→</span>
      <span class="flow-step">Test</span><span class="flow-arrow">→</span>
      <span class="flow-step">Evidence</span><span class="flow-arrow">→</span>
      <span class="flow-step">Organise</span>
    </div>
    <p class="intro-note">It does not begin with “Do I have a case?”</p>
  </div>

  <div class="intro-visual">
    <div class="screenshot-shell">
      <div class="screenshot-chrome"><span></span><span></span><span></span><div>andrea · start a claim</div></div>
      <div class="app-screenshot landing-screenshot" role="img" aria-label="Andrea landing screen showing the common claim categories and the Let's work it out call to action"></div>
    </div>
  </div>
</div>

<DeckFooter page="03" />

<!--
Our solution is Andrea, an AI harness designed to help SRPs prepare for the SCT.

Instead of immediately answering, “Do I have a case?”, Andrea takes the user through a structured process.

It asks what happened, identifies potentially relevant facts, helps organise evidence, considers the other side's position, and guides the user through preparation for filing and the hearing.

But to make this responsible, Andrea has three key guardrails: grounded, proportionate and transparent.
-->

---

<div class="guardrails-head">
  <div>
    <div class="kicker">The guardrails</div>
    <h1>Responsible by design.</h1>
  </div>
  <p class="lede">Grounded. Proportionate. Transparent.<br>Together, they form Andrea’s “GPT”.</p>
</div>

<div class="guardrail-grid">
  <section class="guardrail">
    <div class="guardrail-letter">G</div>
    <h2>Grounded</h2>
    <div class="guardrail-tag">Start with reliable inputs</div>
    <ul>
      <li>Official Legal Sources </li>
      <li>The user’s own account</li>
      <li>User-provided documents and evidence</li>
    </ul>
  </section>

  <section class="guardrail">
    <div class="guardrail-letter">P</div>
    <h2>Proportionate</h2>
    <div class="guardrail-tag">Test, do not simply agree</div>
    <ul>
      <li>What supports this?</li>
      <li>What is still missing?</li>
      <li>What might the other side say?</li>
    </ul>
  </section>

  <section class="guardrail">
    <div class="guardrail-letter">T</div>
    <h2>Transparent</h2>
    <div class="guardrail-tag">Show the status of each claim</div>
    <div class="truth-key">
      <span><b>FACT</b> provided by the user</span>
      <span><b>EVIDENCE</b> supported by a document</span>
      <span><b>POSSIBILITY</b> requires verification</span>
    </div>
    <div class="guardrail-quote">“When it doesn’t know, it doesn’t guess.”</div>
  </section>
</div>

<DeckFooter page="04" />

<!--
Andrea's first guardrail is groundedness. It prioritises authoritative information, such as official SCT and CPFTA sources, together with the evidence provided by the user.

Second is proportionality. For every argument, Andrea asks three questions: What supports it? What's missing? And what might the other side say? This prevents the AI from simply building the strongest possible argument for the user.

Third is transparency. Andrea distinguishes between a fact, which is provided by the user; evidence, which is supported by a document; and a possibility, which requires further verification.

And importantly: “When the system doesn't know, it doesn't guess.” Collectively, these G P T guardrails directly address the risk of AI hallucinations.
-->

---

<div class="facts-grid">
  <div>
    <div class="kicker">From conclusions to facts</div>
    <h1>Andrea gets curious<br>before it gets confident.</h1>
    <div class="user-quote">“I was pressured into buying this.”</div>
    <p class="fact-shift">Andrea asks what happened</p>
    <div class="fact-list">
      <div class="fact-question"><span>1</span>What did you originally go there for?</div>
      <div class="fact-question"><span>2</span>What price did you expect?</div>
      <div class="fact-question"><span>3</span>What were you told?</div>
      <div class="fact-question"><span>4</span>What exactly made you feel pressured?</div>
    </div>
    <p class="fact-note">* This list is non exhaustive and adaptable to various factual matrices.</p>
  </div>

  <div class="facts-visual">
    <div class="screenshot-shell">
      <div class="screenshot-chrome"><span></span><span></span><span></span><div>andrea · guided clarification</div></div>
      <div class="app-screenshot clarification-screenshot" role="img" aria-label="Andrea conversation clarifying the claimant and business details, checking uploaded evidence, and asking for missing information"></div>
    </div>
    <p class="caption">Broad conclusions become specific, examinable facts.</p>
  </div>
</div>

<DeckFooter page="05" />

<!--
The guardrails become particularly important when dealing with a user's own conclusions.

Suppose the user says: “I was pressured into buying this.” Andrea does not simply agree or immediately give them a legal conclusion.

Instead, it asks: What did you originally go there for? What price did you expect? What were you told? And what specifically made you feel pressured?

This helps turn a broad statement like “I was scammed” into specific facts that can be examined and supported by evidence.
-->

---

<div class="bias-head">
  <div>
    <div class="kicker">Evidence + confirmation bias</div>
    <h1>Andrea tests both sides.</h1>
  </div>
  <p class="lede">The goal is not the strongest possible story. It is a story the user understands—including how it may be challenged.</p>
</div>

<div class="both-sides">
  <section class="side-card">
    <div class="side-label">The user’s account</div>
    <h2>“I was pressured.”</h2>
    <div class="side-prompts">
      <span>What supports this account?</span>
      <span>What evidence exists?</span>
      <span>Which details are still uncertain?</span>
    </div>
  </section>

  <section class="side-card respondent">
    <div class="side-label">The respondent’s account</div>
    <h2>What might they argue?</h2>
    <p class="respondent-quote">“You voluntarily agreed to the transaction.”</p>
  </section>
</div>

<div class="test-strip">
  <strong>Andrea tests the gap</strong>
  <span>Was the price explained?</span>
  <span>Did you sign anything?</span>
  <span>Could you refuse?</span>
  <span>What happened after you asked for a refund?</span>
</div>

<p class="bias-caption">A reality-check against assumptions—not an argument generator.</p>

<DeckFooter page="06" />

<!--
Andrea also helps address confirmation bias by testing both sides of the case.

For the user's account, it asks: What supports this? What evidence exists? But it also asks: What might the Respondent argue?

For example, if the user says, “I was pressured,” the Respondent might say: “You voluntarily agreed to the transaction.”

Andrea then asks whether the price was explained, whether the user signed anything, whether they had an opportunity to refuse, and what happened when they requested a refund.

So Andrea is not simply trying to prove the user's story. It helps the user understand how their story might be challenged.
-->

---

<div class="core-grid">
  <div>
    <div class="kicker">The core idea</div>
    <h1>Prepare the person.<br>Organise the case.</h1>
    <div class="shift-card">
      <div class="shift-row"><span>From</span><p>“Tell AI my problem.”</p></div>
      <div class="shift-row"><span>To</span><p>“Help me identify my relevant facts.”</p></div>
    </div>
    <div class="role-list">
      <span>Preparation tool</span>
      <span>Evidence organiser</span>
      <span>Reality-check</span>
      <span>Guide to the SCT process</span>
    </div>
    <p class="boundary">Andrea does not decide who is right, guarantee success, file a claim, or replace the SCT.</p>
  </div>

  <div class="core-visual">
    <div class="screenshot-shell">
      <div class="screenshot-chrome"><span></span><span></span><span></span><div>andrea · court-day pack</div></div>
      <div class="app-screenshot preparation-screenshot" role="img" aria-label="Andrea court-day pack with a downloadable tribunal stack, cue card, pre-filing form, evidence files and filing checklist"></div>
    </div>
    <div class="visual-tag">Confusing experience → clear next step</div>
  </div>
</div>

<DeckFooter page="07" />

<!--
Ultimately, Andrea is based on a simple shift. We want to move from: “Tell AI my problem.” to: “Help AI identify my relevant facts.”

Andrea does not decide who is right, guarantee success, or replace the SCT.

Instead, it helps an ordinary person move from a confusing and daunting experience, to specific facts, supporting evidence, and an organised case.

The goal is not to make AI the lawyer. The goal is to make AI a responsible guide that helps SRPs present their own case more clearly, objectively and confidently.
-->

---
class: ecosystem-slide
---

<div class="kicker">Additional context · open access</div>
<h1>Ground any AI. Make Andrea available anywhere.</h1>
<p class="lede">Official SCT context for the model. Andrea’s guided workflow for the person.</p>

<div class="ecosystem-proof-grid">
  <section class="llms-card">
    <div class="eco-eyebrow">Illustrative public file</div>
    <div class="llms-title-row"><h2>/llms.txt</h2><a href="https://www.judiciary.gov.sg/civil/file-small-claim" target="_blank" rel="noopener noreferrer">Placed on judiciary.gov.sg/civil/file-small-claim/llms.txt ↗</a></div>
    <p class="llms-intro">A short source map points AI agents to current, human-readable SCT guidance.</p>
    <pre class="llms-code"><code># Small Claims Tribunals&#10;&gt; Official guidance for SCT claims in Singapore.&#10;&#10;## Official source&#10;- [File a small claim](https://www.judiciary.gov.sg/civil/file-small-claim)&#10;&#10;## Agent guidance&#10;Use this official page as the canonical source.&#10;Ask for missing facts. Do not predict outcomes.</code></pre>
  </section>

  <section class="mcp-proof-card">
    <div class="mcp-proof-head">
      <div><div class="eco-eyebrow">Andrea inside the assistant people already use</div><h2>ChatGPT + remote MCP</h2></div>
      <span class="connected-pill">CONNECTED</span>
    </div>
    <div class="app-screenshot chatgpt-full-screenshot" role="img" aria-label="ChatGPT using the small claims MCP to record the claimant's account and ask the next grounded follow-up question"></div>
  </section>
</div>

<div class="ecosystem-service-bar">
  <div><span>REMOTE MCP SERVER</span><strong>One guarded workflow, available from any compatible AI application.</strong></div>
</div>

<DeckFooter page="08" inverse />

<!--
Andrea can extend beyond one interface.

First, an llms.txt file on an official MinLaw or justice-domain website could point AI agents towards the right Small Claims Tribunal context and pages. The sample on the left shows how it could identify the key starting points and instruct agents to treat the official pages as canonical. It is a source map, not a replacement for the official human-readable content.

Second, the back-and-forth questionnaire and evidence workflow can be exposed as a remote MCP server. The existing backend remains the authority for case state, while the guardrails travel with the workflow.

The ChatGPT screenshot on the right shows the small claims MCP recording the claimant's account, preserving uncertainty and asking the next grounded follow-up question. That means people could use Andrea through the AI application they already use, without reducing the system to a generic chatbot prompt.
-->

---
class: bento-slide
---

<div class="bento-head">
  <div>
    <div class="kicker">Andrea, in one view</div>
    <h1>A companion for the person<br>behind the claim.</h1>
  </div>
  <p>Less overwhelm. Better organised facts. A clearer path into the official process.</p>
</div>

<div class="bento-grid">
  <section class="bento bento-empathy">
    <div class="bento-label">Empathy for the user</div>
    <h2>Guide your aunty—not just her documents.</h2>
    <p>Plain language, patient questions and a visible next step at every stage.</p>
  </section>

  <section class="bento bento-file">
    <div class="bento-label">Easy to file</div>
    <h2>From scattered details to a reviewed summary.</h2>
    <div class="mini-process"><span>CHECK</span><span>PREPARE</span><span>REVIEW</span></div>
  </section>

  <section class="bento bento-evidence">
    <div class="bento-label">Evidence organisation</div>
    <h2>Everything in one case-ready stack.</h2>
    <p>Original files stay visible and connected to the user’s account.</p>
    <div class="stack-icon"><span></span><span></span><span></span></div>
  </section>

  <section class="bento bento-companion">
    <div class="bento-label">A companion, not a layer</div>
    <h2>Works with the SCT process—never over it.</h2>
    <p>Andrea prepares and reality-checks. The user stays in control.</p>
  </section>

  <section class="bento bento-qa">
    <div><h2>Q&amp;A</h2><p>Thank you.</p></div>
    <div class="qa-mark">?</div>
  </section>
</div>

<DeckFooter page="09" />

<!--
Andrea is designed around the person behind the claim.

It is empathetic enough to guide your aunty, practical enough to make filing preparation easier, and structured enough to keep evidence organised.

Most importantly, it is not another layer over the justice process. It is a companion that helps a person understand, prepare and stay in control.

Thank you. We’re happy to take your questions.
-->
