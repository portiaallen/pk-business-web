import { buildReport, DISCLAIMER } from "@/lib/auntpenny/report";
import { pennyOpening, pennyRoastFor } from "@/lib/auntpenny/penny-voice";
import { prioritizedFindings, personalizedPlan } from "@/lib/auntpenny/case-file";
import type { IntakeAnswers } from "@/lib/auntpenny/roast-engine";

const esc=(s:string)=>s.replace(/[^\x20-\x7e]/g," ").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
const money=(n:number)=>"$"+Math.round(n).toLocaleString("en-US");
type Page={cmd:string[];y:number};
export function auntPennyPdf(a:IntakeAnswers):Uint8Array {
 const report=buildReport(a),findings=prioritizedFindings(report.findings),plan=personalizedPlan(findings);
 const pages:Page[]=[];let p:Page;
 const rgb=(r:number,g:number,b:number)=>[r,g,b].map(n=>(n/255).toFixed(3)).join(" ");
 const ink=rgb(43,20,49),gold=rgb(179,128,57),muted=rgb(94,75,99),magenta=rgb(132,34,94);
 function page(){p={cmd:[],y:736};pages.push(p);p.cmd.push(`q ${rgb(252,249,246)} rg 0 0 612 792 re f Q`);p.cmd.push(`q ${ink} rg 0 758 612 34 re f Q`);p.cmd.push(`BT /F2 10 Tf 1 1 1 rg 42 770 Td (AUNT PENNY  /  THE PRIVATE BOOKS EDITION) Tj ET`);p.cmd.push(`q ${gold} RG 1 w 42 46 m 570 46 l S Q`);p.cmd.push(`BT /F1 9 Tf ${muted} rg 42 31 Td (PK BUSINESS SERVICES  /  PEOPLE  |  KNOWLEDGE  |  RESULTS) Tj ET`);}
 function wrap(s:string,size:number,maxWidth=525){const max=Math.max(18,Math.floor(maxWidth/(size*.53)));const words=esc(s).split(/\s+/);const lines:string[]=[];let line="";for(const word of words){if((line+" "+word).trim().length>max&&line){lines.push(line);line=word;}else line=(line+" "+word).trim();}if(line)lines.push(line);return lines;}
 function write(s:string,size=11,bold=false,color=ink,space=7){const lines=wrap(s,size);const leading=size*1.48;if(p.y-lines.length*leading<76)page();p.cmd.push(`BT /${bold?"F2":"F1"} ${size} Tf ${color} rg 44 ${p.y.toFixed(1)} Td ${lines.map((line,i)=>`${i?"0 -"+leading.toFixed(1)+" Td ":""}(${line}) Tj`).join(" ")} ET`);p.y-=lines.length*leading+space;}
 function title(t:string){if(p.y<160)page();write(t,20,true,magenta,15);}
 function section(t:string){if(p.y<140)page();write(t.toUpperCase(),10,true,gold,9);}
 page();p.y=700;write("ROAST MY BOOKS!",34,true,magenta,14);write("THE RECEIPTS HAVE ENTERED THE CHAT.",13,true,gold,24);
 write("Prepared privately for "+(a.firstName?.trim().slice(0,40)||"a business owner"),12,false,muted,18);
 title("THE OFFICIAL VERDICT");write(report.tierName,19,true,ink,12);write(report.tierLine,12,false,muted,14);
 write(pennyOpening(a),15,true,magenta,18);
 section("Your numbers, your business");write("Monthly revenue: "+money(a.monthlyRevenue)+"     Monthly expenses: "+money(a.monthlyExpenses),12,true);
 write("Difference: "+money(a.monthlyRevenue-a.monthlyExpenses)+"     Cash on hand: "+money(a.cashOnHand),12,true);
 write("These are customer-supplied figures, not verified accounting records.",10,false,muted,16);
 section("Where the money went");
 const scale=Math.max(1,a.monthlyRevenue,a.monthlyExpenses);
 const revenueWidth=Math.max(0,Math.min(490,490*a.monthlyRevenue/scale));
 const expenseWidth=Math.max(0,Math.min(490,490*a.monthlyExpenses/scale));
 if(p.y<230)page();
 p.cmd.push(`q ${rgb(230,214,226)} rg 44 ${(p.y-20).toFixed(1)} 490 19 re f Q`);
 p.cmd.push(`q ${magenta} rg 44 ${(p.y-20).toFixed(1)} ${revenueWidth.toFixed(1)} 19 re f Q`);
 p.y-=27;write("REVENUE  "+money(a.monthlyRevenue),10,true,ink,13);
 p.cmd.push(`q ${rgb(230,214,226)} rg 44 ${(p.y-20).toFixed(1)} 490 19 re f Q`);
 p.cmd.push(`q ${gold} rg 44 ${(p.y-20).toFixed(1)} ${expenseWidth.toFixed(1)} 19 re f Q`);
 p.y-=27;write("EXPENSES  "+money(a.monthlyExpenses),10,true,ink,18);
 write("The bars compare two figures you supplied. They do not establish verified profit or cash flow.",9,false,muted,14);
 page();title("ACT I  /  THE ROAST");
 write("Aunt Penny read your answers. Now the books must answer for themselves.",11,false,muted,16);
 if(!report.triggered.length)write("Your figures did not trigger Aunt Penny's warning signs. Do not mistake that for a professional audit.",12);
 report.triggered.forEach((f,i)=>{section(String(i+1).padStart(2,"0")+"  /  "+f.title);write(pennyRoastFor(f.id,a),12,true,magenta,8);write("Behind the joke: "+f.meaning,10,false,muted,15);});
 page();title("ACT II  /  THE EVIDENCE LOCKER");
 write("Every observation below is based on your submitted answers. Suspicious numbers are questions, not proof of errors.",10,false,muted,18);
 for(const f of findings){section(f.title);write("THE RECEIPT  "+f.evidence,10,true);write("WHY IT MATTERS  "+f.matters,10);write("CHECK  "+f.check,10);write("NEXT MOVE  "+f.next,10);write("GET HELP WHEN  "+f.help,10,false,muted,16);}
 page();title("ACT III  /  THE COMEBACK");
 section("Your first seven days");write("Days 1-2: Gather statements, invoices and supporting records. Verify the submitted numbers.",11);
 write("Days 3-4: "+plan.actions[0].check,11);write("Days 5-6: "+plan.actions[0].action,11);
 write("Day 7: Document what changed, what remains unresolved and what requires professional review.",11,false,ink,20);
 section("Your 30-day rescue");for(const w of plan.week){write(w.label+": "+w.text,11,false,ink,12);}
 title("PRIORITY CHECKLIST");for(let i=0;i<plan.actions.length;i++){const x=plan.actions[i];section((i+1)+". "+x.title);write("CHECK: "+x.check,10);write("DO: "+x.action,10);write("FINISHED WHEN: "+x.done,10,false,muted,12);}
 page();title("THE RECEIPT WORKSHEET");
 write("Aunt Penny cannot fix what nobody wrote down. Use this page when you open the actual statements.",11,false,muted,18);
 for(const label of ["Bank statement month / account:","Starting balance:","Ending statement balance:","Uncategorized transactions checked:","Invoices verified and follow-ups sent:","Subscriptions reviewed and decisions:","Biggest open question:","Professional follow-up / due date:"]){
  section(label);
  if(p.y<115)page();
  p.cmd.push(`q ${rgb(205,184,190)} RG 0.6 w 44 ${p.y.toFixed(1)} m 560 ${p.y.toFixed(1)} l S Q`);
  p.y-=26;
 }
 page();title("ACT IV  /  TAKE THESE RECEIPTS");
 section("Questions for your bookkeeper");write("1. Which observations can be confirmed against my actual records?",12);write("2. Which statements, receipts and reconciliations should I bring?",12);write("3. What is the first realistic fix, and how will we know it worked?",12,false,ink,24);
 title("AUNT PENNY'S LAST WORD");write("Baby, the numbers do not need a motivational speech. They need receipts, a plan, and somebody willing to open the statements.",14,true,magenta,22);
 if(report.bridge.show){section("When you need real bookkeeping help");write(report.bridge.line,11);}
 section("The important fine print");write(DISCLAIMER,9,false,muted,24);
 write("With love, receipts, and absolutely no patience for mystery math - Aunt Penny.",12,true,magenta);
 const objects:string[]=[""];
 const add=(body:string)=>{objects.push(body);return objects.length-1;};
 const font1=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
 const font2=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
 const pageIds:number[]=[];const contentIds:number[]=[];
 for(const pg of pages){const stream=pg.cmd.join("\n")+"\n";const len=new TextEncoder().encode(stream).length;contentIds.push(add(`<< /Length ${len} >>\nstream\n${stream}endstream`));pageIds.push(add("PENDING"));}
 const pagesId=add("PENDING");const catalogId=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
 pageIds.forEach((id,i)=>{objects[id]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;});
 objects[pagesId]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+" 0 R").join(" ")}] /Count ${pageIds.length} >>`;
 let out="%PDF-1.4\n";const offsets=[0];const encoder=new TextEncoder();
 for(let i=1;i<objects.length;i++){offsets.push(encoder.encode(out).length);out+=i+" 0 obj\n"+objects[i]+"\nendobj\n";}
 const xref=encoder.encode(out).length;out+="xref\n0 "+objects.length+"\n0000000000 65535 f \n";
 for(let i=1;i<objects.length;i++)out+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
 out+=`trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return encoder.encode(out);
}
