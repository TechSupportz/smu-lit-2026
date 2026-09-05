// Local fixture adapter only. The production backend owns all eligibility decisions.
import { initialChecks, type EligibilityAnswers, type EligibilityCheck } from './types'
export async function assessDemoEligibility(answers: EligibilityAnswers): Promise<EligibilityCheck[]> {
 await new Promise(resolve => setTimeout(resolve,650))
 return demoChecks(answers)
}
export function demoChecks(a: EligibilityAnswers, now = new Date()): EligibilityCheck[] {
 const value=Number(a.amount)
 const date = a.eventDate ? new Date(`${a.eventDate}T00:00:00`) : null
 const anniversary=date?new Date(date):null
 if(anniversary) anniversary.setFullYear(anniversary.getFullYear()+2)
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate())
 const allowed=['goods','services','tenancy','property','unfair']
 const excluded=['vehicle','neighbour','employment']
 return initialChecks.map(c=>{
  if(c.id==='value') {
   if(!a.amount||!Number.isFinite(value)||value<=0) return {...c,detail:'Enter a claim amount greater than zero.'}
   if(value>30000) return {...c,status:'blocked',detail:'Claims above $30,000 cannot proceed in this flow.'}
   if(value>20000&&!a.consent) return {...c,status:'blocked',detail:'Above $20,000, both parties’ Memorandum of Consent is needed.'}
   return {...c,status:'passed',detail:value>20000?'Within $30,000 with consent confirmed.':'Within the $20,000 limit.'}
  }
  if(c.id==='time') {
   if(!date||!anniversary||Number.isNaN(date.getTime())||date>today) return {...c,detail:'Enter a valid event date, no later than today.'}
   return anniversary<today?{...c,status:'blocked',detail:'The event is more than two years ago.'}:{...c,status:'passed',detail:'Within two years as of today. Recheck before filing.'}
  }
  if(c.id==='location') return a.respondentInSingapore==='yes'?{...c,status:'passed',detail:'Respondent located in Singapore.'}:a.respondentInSingapore==='no'?{...c,status:'blocked',detail:'Respondents outside Singapore cannot proceed in this flow.'}:{...c,detail:'Confirm where the respondent is located.'}
  if(excluded.includes(a.category)) return {...c,status:'blocked',detail:'This type of dispute is excluded from this flow.'}
  if(allowed.includes(a.category)) return {...c,status:'passed',detail:a.category==='tenancy'?'Residential tenancy of no more than two years.':'An eligible dispute category selected.'}
  return {...c,detail:'More information is needed to establish an eligible dispute type.'}
 })
}

/** Static demo artifact, never a legal document or a summary of entered facts. */
export async function createSamplePdf(kind:'filing'|'memo'): Promise<Blob> {
 await new Promise(resolve=>setTimeout(resolve,800))
 const title=kind==='filing'?'Sample filing preparation pack':'Sample legal memo'
 const lines=[title,'CLAIMGUIDE - INTERACTIVE PREVIEW','', 'This is a demonstration PDF only.','It does not contain your case details or legal analysis.','', 'The connected backend will provide the actual PDF.','No claim has been submitted to the court.']
 const content='BT /F1 19 Tf 55 775 Td '+lines.map((line,i)=>`${i?'0 -32 Td ':''}(${line}) Tj`).join('\n')+' ET'
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]
 let pdf='%PDF-1.4\n';const offsets=[0]
 objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`})
 const start=pdf.length
 pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
 return new Blob([pdf],{type:'application/pdf'})
}
