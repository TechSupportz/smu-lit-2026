import { Check, Circle, CircleAlert, LoaderCircle, Minus, PanelRightOpen, FileText, MapPin, CircleDollarSign, PencilLine, ListChecks } from 'lucide-react'
import { Button } from './ui/button'
import { useCase } from '@/lib/store'
import { categories, type CheckStatus } from '@/lib/types'
import { FileCard } from './FileCard'
export function StatusIcon({status}:{status:CheckStatus}) {return status==='passed'?<Check className="status-pass" size={16}/>:status==='blocked'?<CircleAlert className="status-block" size={16}/>:status==='checking'?<LoaderCircle className="spin" size={16}/>:<Circle size={14} className="status-pending"/>}
export function ProgressPanel({open,onToggle,onError,onCorrection}:{open:boolean;onToggle:()=>void;onError:(s:string)=>void;onCorrection:()=>void}) {
 const {answers,checks,details,files,stage,backendCaseId}=useCase()
 const count=checks.filter(c=>c.status==='passed').length
 return <aside className={`progress-panel ${open?'is-open':'is-closed'}`} aria-label="Your case and progress">
  <button className="panel-heading" onClick={onToggle} aria-expanded={open}><span><span className="panel-dot"/>Your case at a glance</span>{open?<Minus size={17}/>:<PanelRightOpen size={18}/>}</button>
  {open&&<div className="panel-content">
   <section><div className="panel-label"><span>ELIGIBILITY</span><span>{count} of {checks.length}</span></div><div className="check-rows">{checks.map(c=><div className="check-row" key={c.id}><StatusIcon status={c.status}/><div><span>{c.label}</span>{c.status==='blocked'&&<small>{c.detail}</small>}</div></div>)}</div></section>
   <section><div className="panel-label"><span>YOUR DETAILS</span>{['filing','preparation'].includes(stage)&&<button title="Correct details through chat" aria-label="Correct details through chat" onClick={onCorrection}><PencilLine size={14}/></button>}</div>
    <div className="detail-row"><ListChecks size={15}/><span>{categories.find(c=>c.value===answers.category)?.label??'Dispute type not added'}</span></div>
    <div className="detail-row"><CircleDollarSign size={15}/><span>{answers.amount?new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD',maximumFractionDigits:0}).format(Number(answers.amount)):'Amount not added'}</span></div>
    <div className="detail-row"><MapPin size={15}/><span>{details.respondent||'Respondent not added'}</span></div>
    {details.summary&&<p className="panel-summary">{details.summary}</p>}
   </section>
   <section><div className="panel-label"><span>DOCUMENTS</span><span>{files.length}</span></div>{files.length?files.map(f=><FileCard key={f.id} file={f} compact onError={onError}/>):<div className="empty-docs"><FileText size={21}/><span>Your files will appear here.</span></div>}</section>
   <div className="panel-foot"><span className="saved-dot"/>{backendCaseId?'Case connected to backend':'Saved in this browser'}</div>
  </div>}
  {!open&&<Button variant="ghost" className="panel-mobile-label" onClick={onToggle}>View checks, details & files</Button>}
 </aside>
}
