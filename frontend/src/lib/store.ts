import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { initialChecks, type Stage, type EligibilityAnswers, type EligibilityCheck, type CaseDetails, type CaseFile } from './types'
const makeKey = () => globalThis.crypto?.randomUUID?.() ?? `case-${Date.now()}-${Math.random().toString(36).slice(2)}`
const defaults = () => ({stage: 'landing' as Stage, started: false, answers: {amount:'',eventDate:'',respondentInSingapore:'',category:'',consent:false} as EligibilityAnswers,checks:initialChecks.map(c=>({...c})), details:{respondent:'',summary:'',outcome:''} as CaseDetails,files:[] as CaseFile[], checklist:[] as string[], consultationDate:'', backendCaseId:null as string|null,backendCreateKey:makeKey(),backendRevision:null as number|null,savedAt:null as string|null})
type CaseState = ReturnType<typeof defaults> & {
 resume:()=>void; go: (stage: Stage) => void; start:(category?:string)=>void; setAnswers:(answers:Partial<EligibilityAnswers>)=>void; setChecks:(checks:EligibilityCheck[])=>void; setDetails:(details:Partial<CaseDetails>)=>void; setBackendCase:(id:string,revision:number)=>void; addFile:(file:CaseFile)=>void; updateFile:(id:string,patch:Partial<CaseFile>)=>void; removeFile:(id:string)=>void; toggleItem:(id:string)=>void; setConsultationDate:(date:string)=>void; reset:()=>void
}
const stamp = () => ({savedAt:new Date().toISOString()})
export const useCase = create<CaseState>()(persist((set,get)=>({
 ...defaults(),
 resume:()=>{const state=get();get().go(state.files.some(f=>f.name.includes('memo')&&f.status==='ready')?'complete':['filed','served','declaration'].every(id=>state.checklist.includes(id))?'preparation':state.files.some(f=>f.name.includes('filing')&&f.status==='ready')?'checkpoint':state.checks.every(c=>c.status==='passed')?'filing':'eligibility')},
 go: stage => {
  const state=get(); const eligible=state.checks.every(c=>c.status==='passed')
  if (['filing','checkpoint','preparation','complete'].includes(stage) && !eligible) {set({stage:'eligibility'});return}
  if (['preparation','complete'].includes(stage) && !['filed','served','declaration'].every(id=>state.checklist.includes(id))) {set({stage:'checkpoint'});return}
  set({stage,...stamp()})
 },
 start:category=>{if(category&&category!==get().answers.category)get().setAnswers({category});set({stage:'eligibility',started:true,...stamp()})},
 setAnswers: answers=>set(s=>({answers:{...s.answers,...answers},checks:initialChecks.map(c=>({...c})),checklist:[],...stamp()})),
 setChecks:checks=>set({checks,...stamp()}),setDetails:details=>set(s=>({details:{...s.details,...details},...stamp()})),
 setBackendCase:(backendCaseId,backendRevision)=>set({backendCaseId,backendRevision,...stamp()}),
 addFile:file=>set(s=>({files:[...s.files,file],...stamp()})),updateFile:(id,patch)=>set(s=>({files:s.files.map(f=>f.id===id?{...f,...patch}:f),...stamp()})),removeFile:id=>set(s=>({files:s.files.filter(f=>f.id!==id),...stamp()})),
 toggleItem:id=>set(s=>({checklist:s.checklist.includes(id)?s.checklist.filter(x=>x!==id):[...s.checklist,id],...stamp()})),
 setConsultationDate:consultationDate=>set({consultationDate,...stamp()}),reset:()=>set(defaults()),
}),{name:'claimguide-case',version:2,storage:createJSONStorage(()=>localStorage),partialize:state=>Object.fromEntries(Object.entries(state).filter(([,v])=>typeof v!=='function')),merge:(persisted,current)=>{const saved=persisted as Partial<CaseState>;const hasBackend=Boolean(saved.backendCaseId);return {...current,...saved,files:(saved.files??[]).map(f=>f.status==='generating'?{...f,status:'failed',error:'Interrupted. Please try generating again.'}:f),checks:hasBackend?(saved.checks??initialChecks).map(c=>c.status==='checking'?{...c,status:'pending'}:c):initialChecks.map(c=>({...c}))}}}))
