import type { IntakeAnswers, Finding } from "./roast-engine";
const money=(n:number)=>"$"+Math.round(n).toLocaleString("en-US");
export function caseSummary(a:IntakeAnswers){
 const remaining=a.monthlyRevenue-a.monthlyExpenses;
 const coverage=a.monthlyExpenses>0?a.cashOnHand/a.monthlyExpenses:null;
 return {remaining,coverage,expenseShare:a.monthlyRevenue>0?Math.round(100*a.monthlyExpenses/a.monthlyRevenue):null, cashGap:Math.max(0,a.monthlyExpenses-a.cashOnHand), monthlyRevenue:money(a.monthlyRevenue),monthlyExpenses:money(a.monthlyExpenses)};
}
const order:Record<string,number>={
 "ramen-reserve":1,"reconciliation-never-heard-of-her":2,"overdue-invoice-choir":3,
 "uncategorized-collection":4,"shrinkflation-pl":5,"credit-card-carousel":6,
 "owners-draw-ocean":7,"subscription-graveyard":8,"shoebox-archive":9,"year-old-mystery":10
};
export function prioritizedFindings(findings:Finding[]){
 return [...findings].sort((a,b)=>(order[a.id]??99)-(order[b.id]??99));
}
export function personalizedPlan(findings:Finding[]){
 const sorted=prioritizedFindings(findings);
 const actions=sorted.map(f=>({title:f.title,check:f.check,action:f.next,done:"Keep a note of what you checked and the records supporting your conclusion."}));
 if(!actions.length)actions.push({title:"Routine maintenance",check:"Review the latest statement against your records.",action:"Schedule the next monthly review.",done:"Save the completed reconciliation and receipts."});
 return {actions,week:[
 {label:"Week 1 · Verify",text:"Gather bank statements, invoice aging and current records. Start with: "+actions[0].check},
 {label:"Week 2 · Resolve",text:actions[0].action},
 {label:"Week 3 · Follow through",text:actions[1]?.action??"Repeat the monthly record checks and resolve open questions."},
 {label:"Week 4 · Confirm",text:"Recheck your figures, document unresolved issues, and review: "+(actions[2]?.action??"your ongoing bookkeeping routine.")}
 ]};
}
