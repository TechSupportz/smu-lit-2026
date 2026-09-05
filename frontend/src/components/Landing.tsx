import { ArrowUpRight, ArrowRight, Check, ShoppingBag, Wrench, KeyRound, PackageOpen, ShieldCheck, FileText, MessageCircle, CornerDownRight, Landmark, LockKeyhole } from 'lucide-react'
import { Button } from './ui/button'
import { useCase } from '@/lib/store'
const options=[{id:'goods',label:'A purchase gone wrong',icon:ShoppingBag},{id:'services',label:'A service not delivered',icon:Wrench},{id:'tenancy',label:'A rental deposit',icon:KeyRound},{id:'property',label:'Damage to my property',icon:PackageOpen}]
export function Landing() {
 const {start,started,resume}=useCase()
 return <>
 <main className="landing-main">
  <section className="hero">
   <div className="hero-copy"><div className="eyebrow"><span/>SMALL CLAIMS. CLEARER NEXT STEPS.</div>
    <h1>A little clarity.<br/>A way <span className="serif-italic">forward.</span></h1>
    <p className="hero-description">When something goes wrong, knowing what to do next shouldn’t be the hard part. We’ll help you prepare your small claim, one step at a time.</p>
    <div className="start-label">What brings you here today?</div>
    <div className="claim-chips">{options.map(({id,label,icon:Icon})=><button key={id} onClick={()=>start(id)}><Icon size={17}/>{label}<ArrowUpRight size={14}/></button>)}</div>
    <Button className="start-button" onClick={()=>start()}>Let’s work it out <ArrowRight size={17}/></Button>
    <p className="start-footnote">Not sure where your claim fits? Start here.</p>
    {started&&<button className="resume-link" onClick={resume}>Welcome back. Continue your saved case <ArrowRight size={15}/></button>}
   </div>
   <div className="hero-art" aria-label="From your story to a prepared claim">
    <div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/>
    <div className="art-label"><span className="tiny-star">✦</span> A LITTLE SUPPORT GOES A LONG WAY</div>
    <div className="story-card"><div className="story-icon"><MessageCircle size={20}/></div><div><span>It starts with your story</span><p>“My landlord hasn’t returned<br/>my rental deposit.”</p></div></div>
    <div className="art-connector"><CornerDownRight size={28}/><span>Let’s take it from here.</span></div>
    <div className="illustration-card"><div className="illustration-top"><span className="mini-brand"><Landmark size={15}/>Your next chapter</span><span className="light-tag">STEP BY STEP</span></div><h3>More prepared.<br/>Less overwhelmed.</h3><div className="art-check"><span><Check size={13}/></span>Understand where you stand</div><div className="art-check"><span><Check size={13}/></span>Get your information together</div><div className="art-check pending"><span><FileText size={12}/></span>Take the next step with confidence</div><div className="art-progress"><i/><i/><i/></div></div>
    <div className="support-note"><ShieldCheck size={19}/><div>At your pace.<small>We’ll keep your place.</small></div></div>
   </div>
  </section>
  <div className="trust-strip"><span><LockKeyhole size={15}/>Private to your browser</span><span><MessageCircle size={15}/>Plain language, always</span><span><FileText size={15}/>Your documents, in one place</span></div>
  <section id="how-it-works" className="how-section"><div className="section-intro"><div className="eyebrow">A PATH THROUGH THE PAPERWORK</div><h2>You don’t have to figure <br/>it all out at once.</h2><p>A guided journey from “what now?”<br/>to knowing your next step.</p></div><div className="steps-grid">{[{n:'01',icon:ShieldCheck,title:'Check where you stand',text:'A few simple questions help check whether your claim fits the Small Claims Tribunals.'},{n:'02',icon:MessageCircle,title:'Tell us what happened',text:'Put your story, supporting documents and claim details together in one guided conversation.'},{n:'03',icon:FileText,title:'Prepare for what’s next',text:'Follow your filing checklist, then return when you’re ready to prepare your case.'}].map(({n,icon:Icon,title,text})=><article className="step-card" key={n}><div className="step-top"><Icon size={21}/><span>{n}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
 </main>
 </>
}
