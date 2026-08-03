
const D=window.INITIAL_DATA, KEY='budget2026.test.v2', BACKUP_KEY='budget2026.test.backups', APP_VERSION='3.4.2-test', MAX_BACKUPS=12;
let state=load(), view='home', month=Math.max(0,Math.min(11,new Date().getFullYear()===2026?new Date().getMonth():0)), deferredPrompt=null;
let txStatusFilter='all', txTypeFilter='all', txSearch='', forecastTypeFilter='all', forecastRange='month', diagnosticResults=null;
function cloneData(v){return JSON.parse(JSON.stringify(v))}
function normalizeState(raw){const base=cloneData(D);if(!raw||typeof raw!=='object')return base;return {...base,...raw,months:Array.isArray(raw.months)?raw.months:base.months,transactions:Array.isArray(raw.transactions)?raw.transactions:base.transactions,recurringBills:Array.isArray(raw.recurringBills)?raw.recurringBills:[],categories:raw.categories&&typeof raw.categories==='object'?raw.categories:base.categories,meta:{...(raw.meta||{}),appVersion:APP_VERSION,lastOpenedAt:new Date().toISOString()}}}
function readBackups(){try{return JSON.parse(localStorage.getItem(BACKUP_KEY))||[]}catch(e){return[]}}
function writeBackups(v){localStorage.setItem(BACKUP_KEY,JSON.stringify(v.slice(0,MAX_BACKUPS)))}
function createBackup(reason='automatique'){try{const raw=localStorage.getItem(KEY);if(!raw)return;const data=JSON.parse(raw),signature=JSON.stringify(data.transactions||[]);let b=readBackups();if(b[0]&&b[0].signature===signature)return;b.unshift({id:'b'+Date.now(),date:new Date().toISOString(),reason,signature,data});writeBackups(b)}catch(e){console.warn(e)}}
function load(){try{const raw=localStorage.getItem(KEY);return raw?normalizeState(JSON.parse(raw)):normalizeState(D)}catch(e){const b=readBackups();return b.length?normalizeState(b[0].data):normalizeState(D)}}
function save(reason='modification'){if(localStorage.getItem(KEY))createBackup(reason);state.meta={...(state.meta||{}),appVersion:APP_VERSION,lastSavedAt:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(state))}
function downloadBackup(){createBackup('export manuel');const blob=new Blob([JSON.stringify({format:'KerBudget Backup',version:APP_VERSION,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='KerBudget-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)}
function importBackupFile(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result),incoming=p.state||p;if(!Array.isArray(incoming.transactions))throw 0;createBackup('avant import');state=normalizeState(incoming);localStorage.setItem(KEY,JSON.stringify(state));render();alert('Sauvegarde importée.')}catch(e){alert('Fichier de sauvegarde invalide.')}};r.readAsText(file)}
function recoverLatestBackup(){const b=readBackups();if(!b.length){alert('Aucune sauvegarde disponible.');return}if(confirm('Restaurer la sauvegarde du '+new Date(b[0].date).toLocaleString('fr-FR')+' ?')){state=normalizeState(cloneData(b[0].data));localStorage.setItem(KEY,JSON.stringify(state));render();alert('Sauvegarde restaurée.')}}
migrateMovements();
window.addEventListener('beforeunload',()=>createBackup('fermeture'));
const euro=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function mtx(i){return state.transactions.filter(t=>(Number.isInteger(t.budgetMonth)?t.budgetMonth:t.month)===i)}
function isSavingsTransfer(t){const s=((t.category||'')+' '+(t.subcategory||'')+' '+(t.description||'')).toLowerCase();return s.includes('épargne')||s.includes('epargne')||s.includes('livret a')}
function savingsOpening(){
  const rows=(window.KERBUDGET_EXCEL_EXTRA?.Epargne||[]);
  const row=rows.find(r=>r&&String(r[1]||'').toLowerCase().includes('solde précédent'));
  return Number(row?.[5] ?? row?.[3] ?? 0)||0;
}
function savingsTransfers(monthIndex=null,pointedOnly=true){
  return state.transactions.filter(t=>
    (monthIndex===null||t.month===monthIndex)&&
    isSavingsType(t)&&
    (!pointedOnly||t.pointed)
  );
}
function savingsImpact(t){
  const amount=Math.abs(Number(t.amount)||0);
  return t.fromAccount==='savings'&&t.toAccount!=='savings'?-amount:amount;
}
function savingsBalance(){
  return savingsOpening()+savingsTransfers(null,true).reduce((s,t)=>s+savingsImpact(t),0);
}

const MOVEMENT_TYPES=[{id:'income',label:'Revenu'},{id:'bill',label:'Facture'},{id:'expense',label:'Dépense'},{id:'savings_transfer',label:'Virement vers épargne'},{id:'internal_transfer',label:'Virement interne'},{id:'refund',label:'Remboursement'}];
const ACCOUNTS=[{id:'checking',label:'Compte courant'},{id:'savings',label:'Livret A'},{id:'cash',label:'Espèces'}];
function inferMovementType(t){if(t.type)return t.type;if(isSavingsTransfer(t))return'savings_transfer';if((t.category||'').trim()==='Revenus')return'income';if(['Habitation','Télécommunications','Assurances','Banque','Impots'].includes((t.category||'').trim()))return'bill';return'expense'}
function normalizeMovement(t){t.type=inferMovementType(t);if(!Number.isInteger(t.budgetMonth))t.budgetMonth=Number.isInteger(t.month)?t.month:0;if(!t.fromAccount)t.fromAccount=(t.type==='income'||t.type==='refund')?null:'checking';if(!t.toAccount)t.toAccount=(t.type==='income'||t.type==='refund')?'checking':(t.type==='savings_transfer'?'savings':null);return t}
function migrateMovements(){let changed=false;state.transactions=state.transactions.map(t=>{let before=JSON.stringify([t.type,t.fromAccount,t.toAccount]);normalizeMovement(t);if(before!==JSON.stringify([t.type,t.fromAccount,t.toAccount]))changed=true;return t});if(changed)localStorage.setItem(KEY,JSON.stringify(state))}
function isIncomeType(t){return['income','refund'].includes(inferMovementType(t))}
function isExpenseType(t){return['bill','expense'].includes(inferMovementType(t))}
function isSavingsType(t){return inferMovementType(t)==='savings_transfer'}
function accountLabel(id){return(ACCOUNTS.find(a=>a.id===id)||{}).label||''}
function typeLabel(id){return(MOVEMENT_TYPES.find(a=>a.id===id)||{}).label||''}
function totals(i){let ts=mtx(i),income=0,expense=0,pincome=0,pexpense=0;for(const t of ts){let rev=isIncomeType(t);if(rev){income+=t.amount;if(t.pointed)pincome+=t.amount}else if(isExpenseType(t)){expense+=t.amount;if(t.pointed)pexpense+=t.amount}}return{income,expense,pincome,pexpense}}
function planned(i){let ls=state.months[i].budgetLines;return{income:ls.filter(x=>x.type==='income').reduce((a,b)=>a+b.planned,0),expense:ls.filter(x=>x.type==='expense').reduce((a,b)=>a+b.planned,0)}}
function cashTotals(i){let income=0,outflow=0,pincome=0,poutflow=0;for(const t of mtx(i)){let rev=isIncomeType(t);if(rev){income+=t.amount;if(t.pointed)pincome+=t.amount}else{outflow+=t.amount;if(t.pointed)poutflow+=t.amount}}return{income,outflow,pincome,poutflow}}
function balance(i,pointed=true){let prev=i===0?state.months[0].openingBalance:balance(i-1,pointed),t=cashTotals(i);return prev+(pointed?t.pincome:t.income)-(pointed?t.poutflow:t.outflow)}
function monthbar(){return `<div class="monthbar">${state.months.map((m,i)=>`<button data-month="${i}" class="${i===month?'active':''}">${m.month}</button>`).join('')}</div>`}
function layout(inner){return `<div class="wrap">${inner}</div>`}
function daysLeftInMonth(i){const n=new Date();if(n.getFullYear()!==2026||n.getMonth()!==i)return new Date(2026,i+1,0).getDate();return Math.max(1,new Date(2026,i+1,0).getDate()-n.getDate()+1)}
function billsPending(i){return mtx(i).filter(t=>inferMovementType(t)==='bill'&&!t.pointed)}
function unpointedMovements(i){return mtx(i).filter(t=>!t.pointed)}
function monthSavings(i){return savingsTransfers(i,true).reduce((s,t)=>s+(Number(t.amount)||0),0)}
function savingsGoal(){const r=(window.KERBUDGET_EXCEL_EXTRA?.Epargne||[]).find(x=>x&&String(x[1]||'').toLowerCase()==='total');return Number(r?.[2]||0)}
function dashboardStatus(i){const p=billsPending(i).length,b=balance(i,false);if(b<0)return{tone:'danger',icon:'🔴',text:'Attention, le solde prévisionnel est négatif.'};if(p>0)return{tone:'warning',icon:'🟠',text:`Il reste ${p} facture${p>1?'s':''} à pointer.`};return{tone:'success',icon:'🟢',text:'Tout est à jour.'}}
function incompleteMovements(i){return mtx(i).filter(t=>!(t.description||'').trim()||!(t.category||'').trim())}
function recurringToGenerate(i){return(state.recurringBills||[]).filter(r=>recurringDue(r,i)&&!state.transactions.some(t=>t.recurringKey===recurringKey(r,i)))}
function importantUpcoming(i){return forecastData(i).rows.slice(0,3)}
function budgetAlerts(i){const out=[],lines=state.months[i].budgetLines||[],plannedByCategory={},spentByCategory={};for(const l of lines){if(l.type!=='expense')continue;const k=(l.category||'Dépenses').trim();plannedByCategory[k]=(plannedByCategory[k]||0)+(Number(l.planned)||0)}for(const t of mtx(i).filter(t=>isExpenseType(t))){const k=(t.category||'Dépenses').trim();spentByCategory[k]=(spentByCategory[k]||0)+(Number(t.amount)||0)}for(const [category,planned] of Object.entries(plannedByCategory)){if(planned<=0)continue;const spent=spentByCategory[category]||0,ratio=spent/planned;if(ratio>1)out.push({tone:'danger',text:`${category} : budget dépassé de ${euro(spent-planned)}`});else if(ratio>=.85)out.push({tone:'warning',text:`${category} : ${(ratio*100).toFixed(0)} % du budget utilisé`})}const projected=balance(i,false);if(projected<0)out.unshift({tone:'danger',text:`Solde prévisionnel négatif de ${euro(Math.abs(projected))}`});return out.slice(0,4)}
function currentDayForMonth(i){const n=new Date();return n.getFullYear()===2026&&n.getMonth()===i?n.getDate():1}
function upcomingWithinDays(i,days=7){const from=currentDayForMonth(i),to=Math.min(new Date(2026,i+1,0).getDate(),from+days-1);return forecastData(i).rows.filter(x=>x.day>=from&&x.day<=to)}
function smartInsights(i){
  const out=[], f=forecastData(i);
  if(f.ending<0)out.push({tone:'danger',icon:'−',text:`Le solde prévisionnel de fin de mois est négatif de ${euro(Math.abs(f.ending))}.`,go:'forecast'});
  return out
}
function navigateTo(target){view=target;render();window.scrollTo({top:0,behavior:'auto'})}
window.navigateTo=navigateTo;
function home(){
  const current=balance(month,true), f=forecastData(month), savingsTotal=savingsBalance(), pending=unpointedMovements(month), week=upcomingWithinDays(month,7), weekOut=week.filter(x=>x.amount<0).reduce((s,x)=>s+Math.abs(x.amount),0), upcoming=f.rows.slice(0,5), insights=smartInsights(month), t=totals(month), p=planned(month), budgetUsed=p.expense>0?Math.min(100,Math.max(0,t.expense/p.expense*100)):0;
  return layout(`${monthbar()}
    <section class="today-head"><div><span>Aujourd’hui</span><h2>${state.months[month].month} 2026</h2><small>Ta situation essentielle en un coup d’œil.</small></div><button class="today-add" data-add>+</button></section>
    <section class="today-grid">
      <button class="today-card main" data-go="forecast"><span class="today-icon">€</span><small>Disponible actuel</small><strong>${euro(current)}</strong><em>Fin de mois : ${euro(f.ending)}</em></button>
      <button class="today-card pending" data-go="transactions"><span class="today-icon">✓</span><small>À pointer</small><strong>${pending.length}</strong><em>${euro(pending.reduce((s,x)=>s+(Number(x.amount)||0),0))}</em></button>
      <button class="today-card upcoming" data-go="forecast"><span class="today-icon">7j</span><small>Sorties à 7 jours</small><strong>${euro(weekOut)}</strong><em>${week.filter(x=>x.amount<0).length} opération${week.filter(x=>x.amount<0).length>1?'s':''}</em></button>
      <button type="button" class="today-card savings" data-go="savings"><span class="today-icon">◆</span><small>Épargne totale</small><strong>${euro(savingsTotal)}</strong><em>Virements pointés</em></button>
    </section>
    <section class="today-section">
      <div class="today-section-head"><div><span>Prochainement</span><h3>Les 5 prochaines opérations</h3></div><button data-go="forecast">Tout voir</button></div>
      ${upcoming.length?`<div class="today-upcoming">${upcoming.map(x=>`<div class="today-operation" ${x.source==='movement'?`data-edit="${esc(x.id)}"`:''}><div class="today-date"><b>${String(x.day).padStart(2,'0')}</b><span>${state.months[month].month.slice(0,3)}</span></div><div><strong>${esc(x.title)}</strong><small>Solde après : ${euro(x.balanceAfter)}</small></div><b class="${x.amount>=0?'positive':'negative'}">${x.amount>=0?'+':'−'}${euro(Math.abs(x.amount))}</b></div>`).join('')}</div>`:'<div class="empty">Aucune opération à venir.</div>'}
    </section>
    ${insights.length?`<section class="today-section">
      <div class="today-section-head"><div><span>Analyse</span><h3>À retenir ce mois-ci</h3></div></div>
      <div class="insight-list">${insights.map(a=>`<button class="insight ${a.tone}" data-go="${a.go}"><i>${a.icon}</i><span>${esc(a.text)}</span><b>›</b></button>`).join('')}</div>
    </section>`:''}
    <section class="today-budget" data-go="budget"><div><span>Budget dépenses</span><strong>${euro(t.expense)} <small>/ ${euro(p.expense)}</small></strong></div><b>${budgetUsed.toFixed(0)} %</b><div class="progress"><i style="width:${budgetUsed}%"></i></div></section>
  `)
}
function transactionTypeGroup(t){
  const type=inferMovementType(t);
  if(type==='income'||type==='refund')return'income';
  if(type==='bill')return'bill';
  if(type==='savings_transfer'||type==='internal_transfer')return'transfer';
  return'expense';
}
function movementIcon(t){const g=transactionTypeGroup(t);return g==='income'?'↗':g==='bill'?'▤':g==='transfer'?'⇄':'−'}
function pointageRow(t){
  normalizeMovement(t);
  const positive=isIncomeType(t),flow=t.fromAccount&&t.toAccount?`${accountLabel(t.fromAccount)} → ${accountLabel(t.toAccount)}`:'';
  const meta=[t.day?String(t.day).padStart(2,'0')+'/'+String(t.month+1).padStart(2,'0')+'/2026':'2026',typeLabel(t.type),t.subcategory,flow].filter(Boolean).join(' · ');
  return `<article class="movement-card ${t.pointed?'is-pointed':'is-pending'}" data-edit="${esc(t.id)}">
    <div class="movement-icon type-${transactionTypeGroup(t)}">${movementIcon(t)}</div>
    <div class="movement-main"><div class="movement-top"><strong>${esc(t.description||t.subcategory||'Mouvement')}</strong><span class="movement-status ${t.pointed?'done':'todo'}">${t.pointed?'Pointé':'À pointer'}</span></div><small>${esc(meta)}</small></div>
    <div class="movement-side"><b class="amount ${positive?'positive':'negative'}">${positive?'+':'−'}${euro(Math.abs(t.amount))}</b><button class="point-toggle" data-toggle-point="${esc(t.id)}" aria-label="${t.pointed?'Marquer non pointé':'Pointer cette opération'}">${t.pointed?'✓':'○'}</button></div>
  </article>`;
}
function filteredPointageRows(){
  return mtx(month).filter(t=>{
    const statusOk=txStatusFilter==='all'||(txStatusFilter==='pending'?!t.pointed:t.pointed);
    const typeOk=txTypeFilter==='all'||transactionTypeGroup(t)===txTypeFilter;
    const hay=(t.description+' '+t.category+' '+t.subcategory+' '+typeLabel(inferMovementType(t))+' '+t.amount).toLowerCase();
    return statusOk&&typeOk&&hay.includes(txSearch.toLowerCase());
  }).sort((a,b)=>{
    if(txStatusFilter==='all'&&a.pointed!==b.pointed)return a.pointed?1:-1;
    return (a.day||0)-(b.day||0);
  });
}
function pointageListHtml(){
  const rows=filteredPointageRows();
  return rows.length?`<div class="movement-list">${rows.map(pointageRow).join('')}</div>`:'<div class="empty pointage-empty">Aucun mouvement ne correspond à ces filtres.</div>';
}
function transactions(){
  const all=mtx(month),pointed=all.filter(t=>t.pointed),pending=all.filter(t=>!t.pointed);
  const pendingAmount=pending.reduce((s,t)=>s+(Number(t.amount)||0),0);
  const statusButtons=[['all','Toutes',all.length],['pointed','Pointées',pointed.length],['pending','À pointer',pending.length]];
  const typeButtons=[['all','Tous types'],['income','Revenus'],['bill','Factures'],['expense','Dépenses'],['transfer','Épargne / virements']];
  return layout(`${monthbar()}
    <div class="section-title movements-title"><div><h2>Mouvements • ${state.months[month].month}</h2><small>Retrouve, pointe et modifie tes opérations au même endroit.</small></div></div>
    <div class="movement-quick-add"><button data-add-type="income">+ Revenu</button><button data-add-type="bill">+ Facture</button><button data-add-type="expense">+ Dépense</button><button data-add-type="savings_transfer">+ Épargne</button></div>
    <section class="pointage-controls movement-controls">
      <input class="search" id="search" value="${esc(txSearch)}" placeholder="Rechercher un libellé, montant ou catégorie…">
      <div class="filter-row status-filters">${statusButtons.map(([id,label,count])=>`<button class="filter-chip ${txStatusFilter===id?'active':''}" data-tx-status="${id}">${label}<b>${count}</b></button>`).join('')}</div>
      <div class="filter-row type-filters">${typeButtons.map(([id,label])=>`<button class="filter-chip secondary-chip ${txTypeFilter===id?'active':''}" data-tx-type="${id}">${label}</button>`).join('')}</div>
    </section>
    <div id="txarea">${pointageListHtml()}</div>
    ${pending.length?`<div class="pointage-footer"><span>${pending.length} mouvement${pending.length>1?'s':''} à pointer</span><strong>${euro(pendingAmount)}</strong></div>`:''}
  `);
}
function budget(){
  const lines=state.months[month].budgetLines||[], tx=mtx(month), p=planned(month), t=totals(month);
  const groups={};
  for(const line of lines){const key=line.type==='income'?'Revenus':line.category;(groups[key]??=[]).push(line)}
  const expenseActual=t.expense, incomeActual=t.income;
  const expenseRemaining=p.expense-expenseActual, incomeGap=incomeActual-p.income;
  const used=p.expense>0?Math.max(0,expenseActual/p.expense*100):0;
  const groupActual=(name,isIncome)=>tx.filter(x=>isIncome?x.category.trim()==='Revenus':x.category.trim()===name.trim()).reduce((a,b)=>a+(Number(b.amount)||0),0);
  const cards=`<section class="budget-overview">
    <div class="budget-kpi primary"><span>Budget dépenses</span><strong>${euro(p.expense)}</strong><small>${used.toFixed(0)} % consommé</small><div class="progress"><i style="width:${Math.min(100,used)}%"></i></div></div>
    <div class="budget-kpi"><span>Dépenses réelles</span><strong class="negative">${euro(expenseActual)}</strong><small>Opérations du mois</small></div>
    <div class="budget-kpi"><span>Reste disponible</span><strong class="${expenseRemaining>=0?'positive':'negative'}">${euro(expenseRemaining)}</strong><small>Prévu − réel</small></div>
    <div class="budget-kpi"><span>Revenus réels</span><strong class="positive">${euro(incomeActual)}</strong><small>${incomeGap>=0?'Avance':'Manque'} de ${euro(Math.abs(incomeGap))}</small></div>
  </section>`;
  const body=Object.entries(groups).map(([name,items])=>{
    const isIncome=name==='Revenus', plannedTotal=items.reduce((s,x)=>s+(Number(x.planned)||0),0), actual=groupActual(name,isIncome), diff=isIncome?actual-plannedTotal:plannedTotal-actual;
    const pct=plannedTotal>0?Math.max(0,actual/plannedTotal*100):0;
    return `<section class="budget-group ${isIncome?'income-group':''}">
      <div class="budget-group-head"><div><h3>${esc(name)}</h3><small>${items.length} poste${items.length>1?'s':''}</small></div><div class="budget-group-totals"><span>Prévu <b>${euro(plannedTotal)}</b></span><span>Réel <b>${euro(actual)}</b></span></div></div>
      <div class="budget-progress"><div class="progress"><i style="width:${Math.min(100,pct)}%"></i></div><small class="${diff>=0?'positive':'negative'}">${isIncome?(diff>=0?'Au-dessus de ':'Sous le prévu de '):(diff>=0?'Reste ':'Dépassé de ')}${euro(Math.abs(diff))}</small></div>
      <div class="budget-lines">${items.map(line=>{const gi=lines.indexOf(line);return `<label class="budget-line"><span><b>${esc(line.label)}</b><small>${isIncome?'Revenu prévu':'Montant prévu'}</small></span><div class="budget-input"><input aria-label="Montant prévu pour ${esc(line.label)}" type="number" step="0.01" value="${line.planned}" data-budget="${gi}"><em>€</em></div></label>`}).join('')}</div>
    </section>`
  }).join('');
  return layout(`${monthbar()}<div class="section-title budget-title"><div><h2>Budget • ${state.months[month].month}</h2><small>Compare le prévu au réel et ajuste les montants directement.</small></div><button class="btn secondary" data-go="home">Terminé</button></div>${cards}<div class="budget-groups">${body}</div>`)
}
function annual(){
  const arr=state.months.map((m,i)=>{const t=totals(i),p=planned(i);return{m:m.month.slice(0,3),name:m.month,inc:t.income,exp:t.expense,planned:p.expense,bal:t.income-t.expense}});
  const inc=arr.reduce((a,b)=>a+b.inc,0),exp=arr.reduce((a,b)=>a+b.exp,0),mx=Math.max(...arr.map(x=>Math.abs(x.bal)),1);
  return layout(`<div class="section-title annual-title"><div><h2>Synthèse annuelle 2026</h2><small>Vue complète des revenus, dépenses et soldes mensuels.</small></div></div>
    <section class="annual-kpis">
      <div class="annual-kpi"><span>Revenus</span><strong class="positive">${euro(inc)}</strong></div>
      <div class="annual-kpi"><span>Dépenses</span><strong class="negative">${euro(exp)}</strong></div>
      <div class="annual-kpi main"><span>Solde annuel</span><strong class="${inc-exp>=0?'positive':'negative'}">${euro(inc-exp)}</strong></div>
    </section>
    <section class="annual-chart-card"><div class="cap">SOLDE MENSUEL</div><div class="annual-chart-scroll"><div class="chart annual-chart">${arr.map(x=>`<div class="barcol"><div class="bar ${x.bal<0?'neg':''}" style="height:${Math.max(3,Math.abs(x.bal)/mx*130)}px"></div><span>${x.m}</span></div>`).join('')}</div></div></section>
    <div class="section-title"><h2>Mois par mois</h2></div>
    <div class="annual-months">${arr.map((x,i)=>`<button type="button" class="annual-month" data-monthgo="${i}"><div class="annual-month-head"><strong>${x.name}</strong><b class="${x.bal>=0?'positive':'negative'}">${euro(x.bal)}</b></div><div class="annual-month-data"><span>Budget <b>${euro(x.planned)}</b></span><span>Dépensé <b>${euro(x.exp)}</b></span><span>Revenus <b>${euro(x.inc)}</b></span></div></button>`).join('')}</div>`)
}
function txList(items){
  if(!items||!items.length)return '<div class="empty">Aucune opération.</div>';
  return `<div class="list">${items.map(t=>{
    const positive=isIncomeType(t);
    const date=t.day?`${String(t.day).padStart(2,'0')}/${String((Number.isInteger(t.month)?t.month:month)+1).padStart(2,'0')}/2026`:'Date non renseignée';
    return `<button type="button" class="row" data-edit="${esc(t.id)}"><div><div class="title">${esc(t.description||t.subcategory||'Mouvement')}</div><div class="sub">${esc(date)} · ${esc(t.subcategory||t.category||'Sans catégorie')}</div></div><div class="amount ${positive?'positive':'negative'}">${positive?'+':'−'}${euro(Math.abs(Number(t.amount)||0))}</div></button>`;
  }).join('')}</div>`;
}
function savingsMovementList(items){
  if(!items.length)return '<div class="empty">Aucun mouvement d’épargne.</div>';
  return `<div class="savings-movements">${items.map(t=>{
    const impact=savingsImpact(t),date=`${String(t.day||1).padStart(2,'0')}/${String((Number.isInteger(t.month)?t.month:0)+1).padStart(2,'0')}/2026`;
    const account=t.toAccount==='savings'?'Livret A':accountLabel(t.toAccount)||'Compte courant';
    const direction=impact>=0?'Versement vers l’épargne':'Retrait de l’épargne';
    return `<button type="button" class="savings-movement ${t.pointed?'is-pointed':'is-pending'}" data-edit="${esc(t.id)}">
      <span class="savings-movement-icon">${impact>=0?'↗':'↙'}</span>
      <span class="savings-movement-main"><strong>${esc(t.description||direction)}</strong><small>${esc(date)} · ${esc(account)} · ${esc(direction)}</small></span>
      <span class="savings-movement-side"><b class="${impact>=0?'positive':'negative'}">${impact>=0?'+':'−'}${euro(Math.abs(impact))}</b><em>${t.pointed?'Pointé':'À pointer'}</em></span>
    </button>`;
  }).join('')}</div>`;
}
function savings(){
  const opening=savingsOpening();
  const allTransfers=savingsTransfers(null,false).slice().sort((a,b)=>((b.month||0)-(a.month||0))||((b.day||0)-(a.day||0)));
  const pointed=allTransfers.filter(t=>t.pointed);
  const unpointed=allTransfers.filter(t=>!t.pointed);
  const deposits=pointed.filter(t=>savingsImpact(t)>=0).reduce((s,t)=>s+savingsImpact(t),0);
  const withdrawals=Math.abs(pointed.filter(t=>savingsImpact(t)<0).reduce((s,t)=>s+savingsImpact(t),0));
  const annual=pointed.reduce((s,t)=>s+savingsImpact(t),0);
  const current=opening+annual;
  const estimated=current+unpointed.reduce((s,t)=>s+savingsImpact(t),0);
  const monthTransfers=allTransfers.filter(t=>t.month===month);
  const rows=(window.KERBUDGET_EXCEL_EXTRA?.Epargne||[]);
  const totalRow=rows.find(r=>r&&String(r[1]||'').toLowerCase()==='total');
  const goal=Number(totalRow?.[2]||0);
  const progress=goal>0?Math.min(100,Math.max(0,current/goal*100)):0;
  return layout(`
    ${monthbar()}
    <section class="hero">
      <div class="label">Épargne • Livret A</div>
      <div class="big">${euro(current)}</div>
      <div class="hero-grid">
        <div class="hero-mini">Solde de départ<b>${euro(opening)}</b></div>
        <div class="hero-mini">Virements pointés<b>${euro(annual)}</b></div>
        <div class="hero-mini">Ce mois-ci<b>${euro(monthTransfers.filter(t=>t.pointed).reduce((s,t)=>s+savingsImpact(t),0))}</b></div>
        <div class="hero-mini">Objectif annuel<b>${euro(goal)}</b></div>
      </div>
    </section>
    <div class="section-title"><h2>Progression de l’épargne</h2></div>
    <div class="card savings-progress-card">
      <div class="progress"><i style="width:${progress}%"></i></div>
      <div class="savings-progress-line"><strong>${progress.toFixed(0)} % de l’objectif</strong><span>${euro(current)} / ${euro(goal)}</span></div>
    </div>
    <div class="section-title"><h2>Détail de l’épargne</h2></div>
    <section class="savings-detail-card">
      <div><span>Épargne de départ</span><b>${euro(opening)}</b></div>
      <div><span>Versements pointés</span><b class="positive">+${euro(deposits)}</b></div>
      <div><span>Retraits pointés</span><b class="negative">−${euro(withdrawals)}</b></div>
      <div class="savings-detail-total"><span>Épargne actuelle</span><b>${euro(current)}</b></div>
      <div><span>Mouvements non pointés</span><b>${euro(unpointed.reduce((s,t)=>s+savingsImpact(t),0))}</b></div>
      <div class="savings-detail-estimate"><span>Épargne estimée après pointage</span><b>${euro(estimated)}</b></div>
    </section>
    <div class="section-title"><h2>Tous les mouvements d’épargne</h2><span class="pill">${allTransfers.length}</span></div>
    ${savingsMovementList(allTransfers)}
  `)
}
function solar(){let paid=state.transactions.filter(t=>/sygma/i.test(t.subcategory)||/sygma/i.test(t.description)).filter(t=>t.pointed).reduce((a,b)=>a+b.amount,0),start=13819.47,remain=Math.max(0,start-paid);return layout(`<div class="hero"><div class="label">Prêt photovoltaïque</div><div class="big">${euro(remain)}</div><div class="hero-grid"><div class="hero-mini">Montant initial<b>${euro(start)}</b></div><div class="hero-mini">Payé / pointé<b>${euro(paid)}</b></div></div></div><div class="section-title"><h2>Échéancier</h2></div><div class="list">${state.solar.map(x=>`<div class="row"><div><div class="title">Échéance ${x.n} · ${esc(x.month)}</div><div class="sub">Montant prévu</div></div><div class="amount">${euro(x.scheduled)}</div></div>`).join('')}</div>`)}

const RECUR_FREQ=[{id:'monthly',label:'Mensuelle'},{id:'quarterly',label:'Trimestrielle'},{id:'yearly',label:'Annuelle'}];
function recurringDue(r,m){
  if(!r.active)return false;
  const start=Number.isInteger(r.startMonth)?r.startMonth:0,end=Number.isInteger(r.endMonth)?r.endMonth:11;
  if(m<start||m>end)return false;
  const delta=m-start;
  return r.frequency==='yearly'?delta===0:r.frequency==='quarterly'?delta%3===0:true;
}
function recurringKey(r,m){return `${r.id}-2026-${String(m+1).padStart(2,'0')}`}
function ensureRecurringForMonth(m,notify=false){
  let created=0;
  for(const r of state.recurringBills||[]){
    if(!recurringDue(r,m))continue;
    const key=recurringKey(r,m);
    if(state.transactions.some(t=>t.recurringKey===key))continue;
    state.transactions.push(normalizeMovement({
      id:'rec-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
      month:m,budgetMonth:m,day:Math.min(31,Math.max(1,Number(r.day)||1)),
      description:r.name,amount:Number(r.amount)||0,category:r.category||'Dépenses',
      subcategory:r.subcategory||'',pointed:false,type:'bill',
      fromAccount:'checking',toAccount:null,recurringId:r.id,recurringKey:key
    }));
    created++;
  }
  if(created){save('génération factures récurrentes');if(notify)alert(`${created} facture${created>1?'s':''} générée${created>1?'s':''}.`)}
  else if(notify)alert('Aucune nouvelle facture à générer pour ce mois.');
  return created;
}
function recurring(){
  const list=(state.recurringBills||[]).slice().sort((a,b)=>(a.day||1)-(b.day||1));
  return layout(`${monthbar()}
    <div class="section-title"><h2>Factures récurrentes</h2><button class="btn" data-recurring-add>+ Ajouter</button></div>
    <div class="recurring-actions"><button class="btn secondary" data-recurring-generate>Générer pour ${state.months[month].month}</button></div>
    <div class="list">${list.length?list.map(r=>`
      <div class="row recurring-row" data-recurring-edit="${esc(r.id)}">
        <div>
          <div class="title">${r.active?'✓ ':'⏸ '}${esc(r.name)}</div>
          <div class="sub">Le ${r.day} · ${(RECUR_FREQ.find(f=>f.id===r.frequency)||{}).label||'Mensuelle'} · ${esc(r.category||'')}</div>
        </div>
        <div class="amount">${euro(r.amount)}</div>
      </div>`).join(''):'<div class="empty">Aucune facture récurrente.</div>'}</div>`);
}
function editRecurring(id){
  const old=id?(state.recurringBills||[]).find(x=>x.id===id):null;
  const r=old||{id:'rb'+Date.now(),name:'',amount:0,category:'Habitation',subcategory:'',day:1,frequency:'monthly',startMonth:0,endMonth:11,active:true,variable:false};
  const cats=Object.keys(state.categories);
  document.querySelector('#modal').hidden=false;
  document.querySelector('#modal').innerHTML=`<div class="sheet"><h2>${old?'Modifier':'Nouvelle'} facture récurrente</h2>
    <div class="field"><label>Nom</label><input id="rname" value="${esc(r.name)}"></div>
    <div class="field"><label>Montant (€)</label><input id="ramount" type="number" step="0.01" value="${r.amount}"></div>
    <div class="field"><label>Jour d’échéance</label><input id="rday" type="number" min="1" max="31" value="${r.day}"></div>
    <div class="field"><label>Fréquence</label><select id="rfreq">${RECUR_FREQ.map(f=>`<option value="${f.id}" ${f.id===r.frequency?'selected':''}>${f.label}</option>`).join('')}</select></div>
    <div class="field"><label>Début</label><select id="rstart">${state.months.map((m,i)=>`<option value="${i}" ${i===r.startMonth?'selected':''}>${m.month}</option>`).join('')}</select></div>
    <div class="field"><label>Fin</label><select id="rend">${state.months.map((m,i)=>`<option value="${i}" ${i===r.endMonth?'selected':''}>${m.month}</option>`).join('')}</select></div>
    <div class="field"><label>Catégorie</label><select id="rcat">${cats.map(c=>`<option ${c===r.category?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="field"><label>Sous-catégorie</label><select id="rsub"></select></div>
    <label class="check"><input id="ractive" type="checkbox" ${r.active?'checked':''}> Active</label>
    <label class="check"><input id="rvariable" type="checkbox" ${r.variable?'checked':''}> Montant variable</label>
    <div class="actions">${old?'<button class="btn danger" id="rdel">Supprimer</button>':''}<button class="btn secondary" id="rcancel">Annuler</button><button class="btn" id="rok">Enregistrer</button></div></div>`;
  const cat=document.querySelector('#rcat'),sub=document.querySelector('#rsub');
  function fillSubs(){const ls=state.categories[cat.value]||[];sub.innerHTML='<option value="">—</option>'+ls.map(x=>`<option ${x===r.subcategory?'selected':''}>${esc(x)}</option>`).join('')}
  cat.onchange=fillSubs;fillSubs();
  document.querySelector('#rcancel').onclick=closeModal;
  document.querySelector('#rok').onclick=()=>{
    const start=+document.querySelector('#rstart').value,end=+document.querySelector('#rend').value;
    if(end<start){alert('La date de fin doit être après la date de début.');return}
    r.name=document.querySelector('#rname').value.trim();
    if(!r.name){alert('Indique un nom.');return}
    r.amount=Math.abs(+document.querySelector('#ramount').value||0);
    r.day=Math.min(31,Math.max(1,+document.querySelector('#rday').value||1));
    r.frequency=document.querySelector('#rfreq').value;r.startMonth=start;r.endMonth=end;
    r.category=cat.value;r.subcategory=sub.value;r.active=document.querySelector('#ractive').checked;r.variable=document.querySelector('#rvariable').checked;
    if(!old)state.recurringBills.push(r);
    save('facture récurrente');closeModal();render()
  };
  const del=document.querySelector('#rdel');
  if(del)del.onclick=()=>{if(confirm('Supprimer cette facture récurrente ? Les mouvements déjà générés resteront conservés.')){state.recurringBills=state.recurringBills.filter(x=>x.id!==r.id);save('suppression facture récurrente');closeModal();render()}}
}
function monthReport(i){const t=totals(i),p=planned(i),pending=mtx(i).filter(x=>!x.pointed),prev=i>0?totals(i-1):null,savings=monthSavings(i),result=t.income-t.expense-savings,cats={};for(const x of mtx(i).filter(x=>isExpenseType(x)&&x.pointed))cats[x.category]=(cats[x.category]||0)+Number(x.amount||0);const diff=(a,b)=>({value:a-b,pct:b?((a-b)/b*100):0});return{t,p,pending,prev,savings,result,top:Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5),incomeDiff:prev?diff(t.income,prev.income):null,expenseDiff:prev?diff(t.expense,prev.expense):null}}
function diffBadge(d,invert=false){if(!d)return'<span class="trend neutral">Premier mois</span>';const good=invert?d.value<=0:d.value>=0;return`<span class="trend ${good?'good':'bad'}">${d.value>=0?'+':''}${euro(d.value)} · ${d.pct>=0?'+':''}${d.pct.toFixed(0)} %</span>`}
function monthlyReport(){const r=monthReport(month),status=r.pending.length?'Provisoire':'À jour';return layout(`${monthbar()}<div class="section-title"><h2>Bilan • ${state.months[month].month}</h2><span class="report-status ${r.pending.length?'provisional':'ready'}">${status}</span></div><div class="report-grid"><section class="report-card"><span>Revenus</span><strong class="positive">${euro(r.t.income)}</strong>${diffBadge(r.incomeDiff)}</section><section class="report-card"><span>Dépenses réelles</span><strong class="negative">${euro(r.t.expense)}</strong>${diffBadge(r.expenseDiff,true)}</section><section class="report-card"><span>Épargne</span><strong>${euro(r.savings)}</strong><small>Virements pointés</small></section><section class="report-card highlight"><span>Résultat du mois</span><strong class="${r.result>=0?'positive':'negative'}">${euro(r.result)}</strong><small>Revenus − dépenses − épargne</small></section></div><div class="section-title"><h2>Situation du mois</h2></div><section class="report-summary"><div><span>Budget prévu</span><b>${euro(r.p.expense)}</b></div><div><span>Dépenses pointées</span><b>${euro(r.t.pexpense)}</b></div><div><span>Reste sur budget</span><b>${euro(r.p.expense-r.t.expense)}</b></div><div><span>Opérations non pointées</span><b>${r.pending.length}</b></div></section>${r.pending.length?`<div class="section-title"><h2>Encore à pointer</h2><button class="btn secondary" data-go="transactions">Voir</button></div>${txList(r.pending.slice(0,6))}`:''}<div class="section-title"><h2>Dépenses par catégorie</h2></div><div class="list">${r.top.length?r.top.map(([c,v])=>`<div class="row"><div><div class="title">${esc(c)}</div><div class="progress"><i style="width:${Math.min(100,v/(r.t.expense||1)*100)}%"></i></div></div><div class="amount">${euro(v)}</div></div>`).join(''):'<div class="empty">Aucune dépense pointée.</div>'}</div>`)}

function forecastEvents(i){
  const events=[];
  for(const t of mtx(i).filter(t=>!t.pointed)){
    normalizeMovement(t);
    const type=inferMovementType(t);
    const isIncome=isIncomeType(t);
    events.push({
      id:t.id,
      day:Math.min(31,Math.max(1,Number(t.day)||1)),
      title:t.description||t.subcategory||typeLabel(type)||'Mouvement',
      amount:isIncome?Math.abs(Number(t.amount)||0):-Math.abs(Number(t.amount)||0),
      kind:isIncome?'income':(type==='savings_transfer'?'savings':type==='bill'?'bill':'expense'),
      source:'movement'
    });
  }
  for(const r of state.recurringBills||[]){
    if(!recurringDue(r,i))continue;
    const key=recurringKey(r,i);
    if(state.transactions.some(t=>t.recurringKey===key))continue;
    events.push({
      id:'planned-'+key,
      day:Math.min(31,Math.max(1,Number(r.day)||1)),
      title:r.name,
      amount:-Math.abs(Number(r.amount)||0),
      kind:'planned',
      source:'recurring'
    });
  }
  return events.sort((a,b)=>a.day-b.day||a.title.localeCompare(b.title,'fr'));
}
function forecastData(i){
  const opening=balance(i,true);
  const events=forecastEvents(i);
  let running=opening,min=opening;
  const rows=events.map(e=>{
    running+=e.amount;
    min=Math.min(min,running);
    return {...e,balanceAfter:running};
  });
  const nextIncome=rows.find(e=>e.amount>0)||null;
  const largestExpense=rows.filter(e=>e.amount<0).sort((a,b)=>a.amount-b.amount)[0]||null;
  return {opening,rows,min,ending:running,nextIncome,largestExpense};
}
function forecastTypeMatches(e,filter){
  if(filter==='all')return true;
  if(filter==='income')return e.kind==='income';
  if(filter==='savings')return e.kind==='savings';
  if(filter==='bill')return e.kind==='bill'||e.kind==='planned';
  if(filter==='expense')return e.kind==='expense';
  return true;
}
function forecastPeriodLabel(day,from,lastDay){
  if(day===from)return "Aujourd’hui";
  if(day===from+1)return 'Demain';
  const offset=day-from;
  if(offset>=2&&offset<=6)return 'Cette semaine';
  if(offset>=7&&offset<=13)return 'La semaine prochaine';
  return 'Plus tard';
}
function cashForecast(){
  const all=forecastData(month),from=currentDayForMonth(month),lastDay=new Date(2026,month+1,0).getDate();
  const rangeDays=forecastRange==='7'?7:forecastRange==='15'?15:(lastDay-from+1),to=Math.min(lastDay,from+rangeDays-1);
  const selected=all.rows.filter(e=>e.day>=from&&e.day<=to&&forecastTypeMatches(e,forecastTypeFilter));
  let running=all.opening,min=running,totalIncome=0,totalOut=0;
  const rows=selected.map(e=>{running+=e.amount;min=Math.min(min,running);if(e.amount>=0)totalIncome+=e.amount;else totalOut+=Math.abs(e.amount);return{...e,balanceAfter:running}});
  const groups=[];
  for(const e of rows){const label=forecastPeriodLabel(e.day,from,lastDay);let g=groups.find(x=>x.label===label);if(!g){g={label,rows:[],total:0};groups.push(g)}g.rows.push(e);g.total+=e.amount}
  const ending=running;
  const alert=min<0?{tone:'danger',icon:'🔴',text:`Découvert prévisionnel : ${euro(min)}`}:min<200?{tone:'warning',icon:'🟠',text:`Solde minimum faible : ${euro(min)}`}:{tone:'success',icon:'🟢',text:'Aucune période de découvert prévue.'};
  const typeFilters=[['all','Tous'],['income','Revenus'],['bill','Factures'],['expense','Dépenses'],['savings','Épargne']];
  const rangeFilters=[['7','7 jours'],['15','15 jours'],['month','Fin du mois']];
  return layout(`${monthbar()}
    <div class="section-title forecast-title"><div><h2>À venir • ${state.months[month].month}</h2><small>Prévision de ton compte à partir des opérations non pointées.</small></div></div>
    <section class="forecast-alert ${alert.tone}"><span>${alert.icon}</span><strong>${alert.text}</strong></section>
    <div class="forecast-cards forecast-summary">
      <div><span>Solde actuel</span><b>${euro(all.opening)}</b></div>
      <div><span>Revenus prévus</span><b class="positive">+${euro(totalIncome)}</b></div>
      <div><span>Dépenses prévues</span><b class="negative">−${euro(totalOut)}</b></div>
      <div><span>Solde prévisionnel</span><b class="${ending>=0?'positive':'negative'}">${euro(ending)}</b></div>
    </div>
    <section class="forecast-controls">
      <div class="forecast-filter-row forecast-types">${typeFilters.map(([id,label])=>`<button class="filter-chip ${forecastTypeFilter===id?'active':''}" data-forecast-type="${id}">${label}</button>`).join('')}</div>
      <div class="forecast-filter-row forecast-ranges">${rangeFilters.map(([id,label])=>`<button class="filter-chip ${forecastRange===id?'active':''}" data-forecast-range="${id}">${label}</button>`).join('')}</div>
    </section>
    <div class="section-title"><h2>Chronologie</h2><span>${rows.length} opération${rows.length>1?'s':''}</span></div>
    <div class="forecast-timeline forecast-groups">
      ${groups.length?groups.map(g=>`<section class="forecast-group">
        <header><div><span>${g.label}</span><small>${g.rows.length} opération${g.rows.length>1?'s':''}</small></div><b class="${g.total>=0?'positive':'negative'}">${g.total>=0?'+':'−'}${euro(Math.abs(g.total))}</b></header>
        <div class="forecast-group-list">${g.rows.map(e=>`<div class="forecast-row ${e.kind}" ${e.source==='movement'?`data-edit="${esc(e.id)}"`:''}>
          <div class="forecast-date"><b>${String(e.day).padStart(2,'0')}</b><small>${state.months[month].month.slice(0,3)}</small></div>
          <div class="forecast-main"><strong>${esc(e.title)}</strong><small>${e.source==='recurring'?'Échéance récurrente':'Mouvement à pointer'}</small></div>
          <div class="forecast-values"><b class="${e.amount>=0?'positive':'negative'}">${e.amount>=0?'+':'−'}${euro(Math.abs(e.amount))}</b><small>Solde : ${euro(e.balanceAfter)}</small></div>
        </div>`).join('')}</div>
        <footer>Solde estimé après cette période <b>${euro(g.rows[g.rows.length-1].balanceAfter)}</b></footer>
      </section>`).join(''):'<div class="empty">Aucune opération pour ces filtres.</div>'}
    </div>
  `);
}

function categoryUsage(name){
  return state.transactions.filter(t=>t.category===name).length+(state.recurringBills||[]).filter(r=>r.category===name).length+state.months.reduce((n,m)=>n+(m.budgetLines||[]).filter(l=>l.category===name).length,0);
}
function categoriesPage(){
  const cats=Object.entries(state.categories||{});
  return layout(`<div class="section-title categories-title"><div><h2>Catégories</h2><small>Personnalise les catégories et leurs sous-catégories.</small></div><button class="btn" data-category-add>+ Catégorie</button></div>
    <div class="category-list">${cats.map(([name,subs])=>`<section class="category-card">
      <div class="category-head"><div><h3>${esc(name)}</h3><small>${categoryUsage(name)} utilisation${categoryUsage(name)>1?'s':''}</small></div><div class="category-actions"><button data-category-rename="${esc(name)}" aria-label="Renommer">✎</button><button data-category-delete="${esc(name)}" aria-label="Supprimer" ${name==='Revenus'?'disabled':''}>×</button></div></div>
      <div class="subcategory-list">${(subs||[]).length?(subs||[]).map(sub=>`<div class="subcategory-row"><span>${esc(sub)}</span><div><button data-sub-rename="${esc(name)}|${esc(sub)}">✎</button><button data-sub-delete="${esc(name)}|${esc(sub)}">×</button></div></div>`).join(''):'<div class="subcategory-empty">Aucune sous-catégorie</div>'}</div>
      <button class="add-subcategory" data-sub-add="${esc(name)}">+ Ajouter une sous-catégorie</button>
    </section>`).join('')}</div>`);
}
function addCategory(){const name=(prompt('Nom de la nouvelle catégorie :')||'').trim();if(!name)return;if(state.categories[name]){alert('Cette catégorie existe déjà.');return}state.categories[name]=[];save('ajout catégorie');render()}
function renameCategory(oldName){const name=(prompt('Nouveau nom de la catégorie :',oldName)||'').trim();if(!name||name===oldName)return;if(state.categories[name]){alert('Cette catégorie existe déjà.');return}state.categories[name]=state.categories[oldName]||[];delete state.categories[oldName];state.transactions.forEach(t=>{if(t.category===oldName)t.category=name});(state.recurringBills||[]).forEach(r=>{if(r.category===oldName)r.category=name});state.months.forEach(m=>(m.budgetLines||[]).forEach(l=>{if(l.category===oldName)l.category=name}));save('renommage catégorie');render()}
function deleteCategory(name){if(name==='Revenus'){alert('La catégorie Revenus est protégée.');return}const count=categoryUsage(name);const msg=count?`Cette catégorie est utilisée ${count} fois. Les éléments seront déplacés vers « Sans catégorie ». Continuer ?`:'Supprimer cette catégorie ?';if(!confirm(msg))return;if(!state.categories['Sans catégorie'])state.categories['Sans catégorie']=[];state.transactions.forEach(t=>{if(t.category===name){t.category='Sans catégorie';t.subcategory=''}});(state.recurringBills||[]).forEach(r=>{if(r.category===name){r.category='Sans catégorie';r.subcategory=''}});state.months.forEach(m=>(m.budgetLines||[]).forEach(l=>{if(l.category===name)l.category='Sans catégorie'}));delete state.categories[name];save('suppression catégorie');render()}
function addSubcategory(cat){const name=(prompt('Nom de la nouvelle sous-catégorie :')||'').trim();if(!name)return;const list=state.categories[cat]||(state.categories[cat]=[]);if(list.includes(name)){alert('Cette sous-catégorie existe déjà.');return}list.push(name);list.sort((a,b)=>a.localeCompare(b,'fr'));save('ajout sous-catégorie');render()}
function renameSubcategory(cat,oldName){const name=(prompt('Nouveau nom de la sous-catégorie :',oldName)||'').trim();if(!name||name===oldName)return;const list=state.categories[cat]||[];if(list.includes(name)){alert('Cette sous-catégorie existe déjà.');return}const i=list.indexOf(oldName);if(i>=0)list[i]=name;state.transactions.forEach(t=>{if(t.category===cat&&t.subcategory===oldName)t.subcategory=name});(state.recurringBills||[]).forEach(r=>{if(r.category===cat&&r.subcategory===oldName)r.subcategory=name});save('renommage sous-catégorie');render()}
function deleteSubcategory(cat,name){const used=state.transactions.filter(t=>t.category===cat&&t.subcategory===name).length+(state.recurringBills||[]).filter(r=>r.category===cat&&r.subcategory===name).length;if(!confirm(used?`Cette sous-catégorie est utilisée ${used} fois. Les éléments conserveront la catégorie mais n’auront plus de sous-catégorie. Continuer ?`:'Supprimer cette sous-catégorie ?'))return;state.categories[cat]=(state.categories[cat]||[]).filter(x=>x!==name);state.transactions.forEach(t=>{if(t.category===cat&&t.subcategory===name)t.subcategory=''});(state.recurringBills||[]).forEach(r=>{if(r.category===cat&&r.subcategory===name)r.subcategory=''});save('suppression sous-catégorie');render()}


function bytesLabel(bytes){
  const n=Number(bytes)||0;
  if(n<1024)return n+' o';
  if(n<1024*1024)return (n/1024).toFixed(1)+' Ko';
  return (n/1024/1024).toFixed(2)+' Mo';
}
function diagnosticSnapshot(){
  const raw=localStorage.getItem(KEY)||'';
  const categories=Object.keys(state.categories||{});
  const subCount=categories.reduce((n,c)=>n+((state.categories[c]||[]).length),0);
  const budgets=(state.months||[]).reduce((n,m)=>n+((m.budgetLines||[]).length),0);
  const savingsAccounts=new Set(savingsTransfers(null,false).flatMap(t=>[t.fromAccount,t.toAccount]).filter(x=>x==='savings')).size;
  const b=readBackups();
  return {
    size:bytesLabel(new Blob([raw]).size),
    movements:(state.transactions||[]).length,
    categories:categories.length,
    subcategories:subCount,
    budgets,
    savingsAccounts,
    backups:b.length,
    lastBackup:b[0]?new Date(b[0].date).toLocaleString('fr-FR'):'Aucune',
    lastSaved:state.meta?.lastSavedAt?new Date(state.meta.lastSavedAt).toLocaleString('fr-FR'):'Aucune'
  };
}
function analyzeKerBudget(){
  const issues=[];
  const cats=state.categories||{};
  const catNames=Object.keys(cats);
  const transactions=state.transactions||[];
  const missingCategory=transactions.filter(t=>!(t.category||'').trim());
  if(missingCategory.length)issues.push({level:'error',title:'Mouvements sans catégorie',detail:`${missingCategory.length} mouvement${missingCategory.length>1?'s':''} à corriger.`});
  const unknownCategory=transactions.filter(t=>(t.category||'').trim()&&!catNames.includes((t.category||'').trim()));
  if(unknownCategory.length)issues.push({level:'warning',title:'Catégories inconnues',detail:`${unknownCategory.length} mouvement${unknownCategory.length>1?'s utilisent':' utilise'} une catégorie absente de la liste.`});
  const invalidSubs=transactions.filter(t=>{const c=(t.category||'').trim(),sub=(t.subcategory||'').trim();return sub&&Array.isArray(cats[c])&&!cats[c].includes(sub)});
  if(invalidSubs.length)issues.push({level:'warning',title:'Sous-catégories invalides',detail:`${invalidSubs.length} mouvement${invalidSubs.length>1?'s sont':' est'} associé${invalidSubs.length>1?'s':''} à une sous-catégorie inexistante.`});
  const orphanBudgets=[];
  (state.months||[]).forEach((m,mi)=>(m.budgetLines||[]).forEach(l=>{if(l.type!=='income'&&l.category&&!catNames.includes(l.category))orphanBudgets.push({month:mi,line:l})}));
  if(orphanBudgets.length)issues.push({level:'warning',title:'Budgets orphelins',detail:`${orphanBudgets.length} ligne${orphanBudgets.length>1?'s':''} de budget utilisent une catégorie supprimée.`});
  const badSavings=savingsTransfers(null,false).filter(t=>!(t.fromAccount&&t.toAccount)||t.fromAccount===t.toAccount);
  if(badSavings.length)issues.push({level:'error',title:'Virements d’épargne incomplets',detail:`${badSavings.length} virement${badSavings.length>1?'s doivent':' doit'} avoir un compte de départ et un compte d’arrivée différents.`});
  const unused=catNames.filter(c=>c!=='Revenus'&&!transactions.some(t=>(t.category||'').trim()===c)&&!(state.months||[]).some(m=>(m.budgetLines||[]).some(l=>(l.category||'').trim()===c)));
  if(unused.length)issues.push({level:'info',title:'Catégories inutilisées',detail:`${unused.length} catégorie${unused.length>1?'s ne sont':' n’est'} actuellement utilisée${unused.length>1?'s':''}.`});
  diagnosticResults={date:new Date().toISOString(),issues};
  return diagnosticResults;
}
function diagnosticReportText(){
  const result=diagnosticResults||analyzeKerBudget(),snap=diagnosticSnapshot();
  const status=result.issues.some(x=>x.level==='error')?'À corriger':result.issues.some(x=>x.level==='warning')?'À vérifier':'Bon';
  return [
    'KerBudget '+APP_VERSION,
    'Rapport du '+new Date(result.date).toLocaleString('fr-FR'),
    'État général : '+status,
    '',
    `Mouvements : ${snap.movements}`,
    `Catégories : ${snap.categories}`,
    `Sous-catégories : ${snap.subcategories}`,
    `Lignes de budget : ${snap.budgets}`,
    `Taille des données : ${snap.size}`,
    `Dernière sauvegarde : ${snap.lastBackup}`,
    '',
    result.issues.length?'Points détectés :':'Aucun problème détecté.',
    ...result.issues.map(x=>`- [${x.level.toUpperCase()}] ${x.title} — ${x.detail}`)
  ].join('\n');
}
function downloadDiagnosticReport(){
  const blob=new Blob([diagnosticReportText()],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='KerBudget-rapport-diagnostic-'+new Date().toISOString().slice(0,10)+'.txt';a.click();URL.revokeObjectURL(a.href);
}
function diagnostic(){
  const snap=diagnosticSnapshot(),result=diagnosticResults;
  const errors=result?result.issues.filter(x=>x.level==='error').length:0,warnings=result?result.issues.filter(x=>x.level==='warning').length:0;
  const status=!result?{tone:'neutral',label:'Analyse non lancée',icon:'…'}:errors?{tone:'danger',label:`${errors} erreur${errors>1?'s':''}`,icon:'!'}:warnings?{tone:'warning',label:`${warnings} point${warnings>1?'s':''} à vérifier`,icon:'!'}:{tone:'success',label:'Tout est conforme',icon:'✓'};
  const checks=result?result.issues.map(x=>`<article class="diagnostic-issue ${x.level}"><b>${x.level==='error'?'✕':x.level==='warning'?'!':'i'}</b><div><strong>${esc(x.title)}</strong><small>${esc(x.detail)}</small></div></article>`).join(''):'<div class="diagnostic-placeholder">Lance l’analyse pour vérifier la cohérence des données.</div>';
  return layout(`<div class="section-title diagnostic-title"><div><h2>Diagnostic KerBudget</h2><small>Contrôle de l’application et de tes données locales.</small></div><button class="btn secondary" data-go="more">Retour</button></div>
    <section class="diagnostic-status ${status.tone}"><b>${status.icon}</b><div><span>État général</span><strong>${status.label}</strong>${result?`<small>Analyse du ${new Date(result.date).toLocaleString('fr-FR')}</small>`:''}</div></section>
    <section class="diagnostic-grid">
      <div><span>Version</span><strong>3.4.2 Test</strong></div><div><span>Taille des données</span><strong>${snap.size}</strong></div>
      <div><span>Mouvements</span><strong>${snap.movements}</strong></div><div><span>Catégories</span><strong>${snap.categories}</strong></div>
      <div><span>Sous-catégories</span><strong>${snap.subcategories}</strong></div><div><span>Lignes de budget</span><strong>${snap.budgets}</strong></div>
      <div><span>Sauvegardes locales</span><strong>${snap.backups}</strong></div><div><span>Dernier enregistrement</span><strong class="small-value">${esc(snap.lastSaved)}</strong></div>
    </section>
    <section class="diagnostic-card"><div class="diagnostic-card-head"><div><span>Vérifications automatiques</span><h3>Intégrité des données</h3></div><button class="btn" data-run-diagnostic>Analyser KerBudget</button></div><div class="diagnostic-results">${checks}</div></section>
    <section class="diagnostic-card"><div class="diagnostic-card-head"><div><span>Rapport</span><h3>Conserver ou partager le résultat</h3></div></div><p>Le rapport contient uniquement des informations techniques et les anomalies détectées. Il ne modifie aucune donnée.</p><button class="btn secondary" data-download-diagnostic ${result?'':'disabled'}>Télécharger le rapport</button></section>
  `);
}

function more(){const b=readBackups(),last=b[0]?new Date(b[0].date).toLocaleString('fr-FR'):'Aucune';return layout(`<div class="quick-links"><button data-go="annual"><b>▥</b><span>Synthèse annuelle</span></button><button type="button" data-go="savings"><b>◆</b><span>Épargne</span></button></div><div class="section-title"><h2>Outils</h2></div><div class="settings-grid"><section class="settings-card diagnostic-entry"><h3>🛠️ Diagnostic</h3><p>Vérifier l’intégrité des mouvements, catégories, budgets, sauvegardes et virements d’épargne.</p><button class="btn" data-go="diagnostic">Ouvrir le diagnostic</button></section><section class="settings-card"><h3>🏷️ Catégories et sous-catégories</h3><p>Ajouter, renommer ou supprimer les catégories utilisées dans les mouvements.</p><button class="btn" data-go="categories">Gérer les catégories</button></section><section class="settings-card"><h3>🔒 Sécurité des données</h3><p>Les mises à jour conservent les données enregistrées sur cet appareil.</p><div class="security-status"><div><span>Version</span><strong>KerBudget 3.4.2 Test</strong></div><div><span>Sauvegardes locales</span><strong>${b.length}</strong></div><div><span>Dernière sauvegarde</span><strong>${last}</strong></div></div><div class="action-stack"><button class="btn" data-backup-download>Exporter une sauvegarde</button><button class="btn secondary" data-backup-import>Importer une sauvegarde</button><button class="btn secondary" data-backup-restore>Restaurer la dernière sauvegarde locale</button><input type="file" id="backupFileInput" accept="application/json,.json" hidden></div></section><section class="settings-card"><h3>📊 Bilan mensuel</h3><p>Consulter le résultat, les dépenses par catégorie et les opérations restant à pointer.</p><button class="btn" data-go="report">Ouvrir le bilan</button></section><section class="settings-card"><h3>💶 Budget mensuel</h3><p>Comparer les montants prévus aux dépenses et revenus réels.</p><button class="btn" data-go="budget">Ouvrir le budget</button></section><section class="settings-card"><h3>🔁 Factures récurrentes</h3><p>Créer automatiquement les échéances mensuelles, trimestrielles ou annuelles.</p><button class="btn" data-go="recurring">Gérer les factures</button></section><section class="settings-card"><h3>☀ Prêt photovoltaïque</h3><button class="btn secondary" data-go="solar">Ouvrir l'échéancier</button></section><section class="settings-card"><h3>Maintenance</h3><button class="btn secondary" data-export>Exporter les données brutes</button><button class="btn secondary" data-import>Importer les données brutes</button><input id="fileInput" type="file" accept="application/json" hidden><button class="btn danger" data-reset>Réinitialiser depuis Excel</button></section></div>`)}
function render(){let html=view==='home'?home():view==='transactions'?transactions():view==='forecast'?cashForecast():view==='annual'?annual():view==='savings'?savings():view==='budget'?budget():view==='solar'?solar():view==='recurring'?recurring():view==='report'?monthlyReport():view==='categories'?categoriesPage():view==='diagnostic'?diagnostic():more();document.querySelector('#app').innerHTML=html;document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));bind()}
function bind(){document.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{month=+b.dataset.month;ensureRecurringForMonth(month);render()});document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{view=b.dataset.go;render()});document.querySelectorAll('[data-open-savings]').forEach(b=>b.onclick=()=>{view='savings';render()});document.querySelectorAll('[data-monthgo]').forEach(b=>b.onclick=()=>{month=+b.dataset.monthgo;ensureRecurringForMonth(month);view='home';render()});document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>editTx());document.querySelectorAll('[data-add-type]').forEach(b=>b.onclick=()=>editTx(null,b.dataset.addType));document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit));document.querySelectorAll('[data-toggle-point]').forEach(b=>b.onclick=e=>{e.stopPropagation();const t=state.transactions.find(x=>x.id===b.dataset.togglePoint);if(t){t.pointed=!t.pointed;save('pointage');render()}});document.querySelectorAll('[data-tx-status]').forEach(b=>b.onclick=()=>{txStatusFilter=b.dataset.txStatus;render()});document.querySelectorAll('[data-tx-type]').forEach(b=>b.onclick=()=>{txTypeFilter=b.dataset.txType;render()});document.querySelectorAll('[data-forecast-type]').forEach(b=>b.onclick=()=>{forecastTypeFilter=b.dataset.forecastType;render()});document.querySelectorAll('[data-forecast-range]').forEach(b=>b.onclick=()=>{forecastRange=b.dataset.forecastRange;render()});document.querySelectorAll('[data-budget]').forEach(i=>i.onchange=()=>{state.months[month].budgetLines[+i.dataset.budget].planned=+i.value||0;save()});let q=document.querySelector('#search');if(q)q.oninput=()=>{txSearch=q.value;document.querySelector('#txarea').innerHTML=pointageListHtml();document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit));document.querySelectorAll('[data-toggle-point]').forEach(b=>b.onclick=e=>{e.stopPropagation();const t=state.transactions.find(x=>x.id===b.dataset.togglePoint);if(t){t.pointed=!t.pointed;save('pointage');render()}})};let ex=document.querySelector('[data-export]');if(ex)ex.onclick=exportData;let im=document.querySelector('[data-import]');if(im)im.onclick=()=>document.querySelector('#fileInput').click();let fi=document.querySelector('#fileInput');if(fi)fi.onchange=importData;let bd=document.querySelector('[data-backup-download]');if(bd)bd.onclick=downloadBackup;let bi=document.querySelector('[data-backup-import]');if(bi)bi.onclick=()=>document.querySelector('#backupFileInput').click();let bf=document.querySelector('#backupFileInput');if(bf)bf.onchange=e=>{if(e.target.files[0])importBackupFile(e.target.files[0])};let br=document.querySelector('[data-backup-restore]');if(br)br.onclick=recoverLatestBackup;document.querySelectorAll('[data-recurring-edit]').forEach(x=>x.onclick=()=>editRecurring(x.dataset.recurringEdit));
let ra=document.querySelector('[data-recurring-add]');if(ra)ra.onclick=()=>editRecurring();
let rg=document.querySelector('[data-recurring-generate]');if(rg)rg.onclick=()=>{ensureRecurringForMonth(month,true);render()};
document.querySelectorAll('[data-category-add]').forEach(b=>b.onclick=addCategory);document.querySelectorAll('[data-category-rename]').forEach(b=>b.onclick=()=>renameCategory(b.dataset.categoryRename));document.querySelectorAll('[data-category-delete]').forEach(b=>b.onclick=()=>deleteCategory(b.dataset.categoryDelete));document.querySelectorAll('[data-sub-add]').forEach(b=>b.onclick=()=>addSubcategory(b.dataset.subAdd));document.querySelectorAll('[data-sub-rename]').forEach(b=>b.onclick=()=>{const [c,...rest]=b.dataset.subRename.split('|');renameSubcategory(c,rest.join('|'))});document.querySelectorAll('[data-sub-delete]').forEach(b=>b.onclick=()=>{const [c,...rest]=b.dataset.subDelete.split('|');deleteSubcategory(c,rest.join('|'))});
let rd=document.querySelector('[data-run-diagnostic]');if(rd)rd.onclick=()=>{analyzeKerBudget();render()};let dd=document.querySelector('[data-download-diagnostic]');if(dd)dd.onclick=downloadDiagnosticReport;
let rs=document.querySelector('[data-reset]');if(rs)rs.onclick=()=>{if(confirm('Attention : une sauvegarde sera créée avant la réinitialisation. Continuer ?')){createBackup('avant réinitialisation');state=normalizeState(D);localStorage.setItem(KEY,JSON.stringify(state));render()}}}
function editTx(id,presetType=null){
  let old=id?state.transactions.find(t=>t.id===id):null;
  let t=normalizeMovement(old||{id:'u'+Date.now(),month,day:new Date().getDate(),description:'',amount:0,category:'Dépenses',subcategory:'',pointed:false,type:presetType||'expense',fromAccount:'checking',toAccount:null});
  let cats=Object.keys(state.categories);
  const compactTypes=[
    {id:'income',label:'Revenu',icon:'↗'},
    {id:'bill',label:'Facture',icon:'▤'},
    {id:'expense',label:'Dépense',icon:'−'},
    {id:'savings_transfer',label:'Épargne',icon:'◆'}
  ];
  const selectedCompact=compactTypes.some(x=>x.id===t.type)?t.type:'expense';
  document.querySelector('#modal').hidden=false;
  document.querySelector('#modal').innerHTML=`<div class="sheet movement-sheet">
    <div class="form-head"><div><span>${old?'MODIFICATION':'NOUVEAU'}</span><h2>${old?'Modifier le mouvement':'Nouveau mouvement'}</h2></div><button class="sheet-close" id="cancel" aria-label="Fermer">×</button></div>
    <div class="type-selector">${compactTypes.map(x=>`<button type="button" data-form-type="${x.id}" class="${x.id===selectedCompact?'active':''}"><b>${x.icon}</b><span>${x.label}</span></button>`).join('')}</div>
    <select id="ftype" hidden>${MOVEMENT_TYPES.map(x=>`<option value="${x.id}" ${x.id===t.type?'selected':''}>${esc(x.label)}</option>`).join('')}</select>
    <div class="amount-field"><label for="famount">Montant</label><div><input id="famount" type="number" inputmode="decimal" step="0.01" min="0" value="${Math.abs(Number(t.amount)||0)}" placeholder="0,00"><span>€</span></div></div>
    <div class="field primary-field"><label for="fdesc">Libellé</label><input id="fdesc" autocomplete="off" value="${esc(t.description)}" placeholder="Ex. Courses, salaire, EDF…"></div>
    <div class="form-grid two">
      <div class="field"><label for="fday">Jour</label><input id="fday" type="number" inputmode="numeric" min="1" max="31" value="${t.day||new Date().getDate()}"></div>
      <div class="field"><label for="fbudgetmonth">Mois</label><select id="fbudgetmonth">${state.months.map((m,i)=>`<option value="${i}" ${i===(Number.isInteger(t.budgetMonth)?t.budgetMonth:t.month)?'selected':''}>${m.month}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="fcat">Catégorie</label><select id="fcat">${cats.map(c=>`<option ${c===t.category?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="point-switch"><div><b>Statut de l’opération</b><small id="pointLabel">${t.pointed?'Pointée':'À pointer'}</small></div><label class="switch"><input id="fpoint" type="checkbox" ${t.pointed?'checked':''}><span></span></label></div>
    <details class="more-details"><summary>Plus de détails</summary><div class="details-content">
      <div class="field"><label for="fsub">Sous-catégorie</label><select id="fsub"></select></div>
      <div class="field" id="fromWrap"><label for="ffrom">Compte de départ</label><select id="ffrom">${ACCOUNTS.map(x=>`<option value="${x.id}" ${x.id===t.fromAccount?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>
      <div class="field" id="toWrap"><label for="fto">Compte d’arrivée</label><select id="fto">${ACCOUNTS.map(x=>`<option value="${x.id}" ${x.id===t.toAccount?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>
    </div></details>
    ${old?'<div class="secondary-actions"><button class="btn secondary" id="duplicate">Dupliquer</button><button class="btn danger" id="del">Supprimer</button></div>':''}
    <div class="form-save"><button class="btn" id="ok">${old?'Enregistrer les modifications':'Ajouter le mouvement'}</button></div>
  </div>`;
  let type=document.querySelector('#ftype'),cat=document.querySelector('#fcat'),sub=document.querySelector('#fsub'),from=document.querySelector('#ffrom'),to=document.querySelector('#fto');
  function subs(){let list=state.categories[cat.value]||[];sub.innerHTML='<option value="">—</option>'+list.map(x=>`<option ${x===t.subcategory?'selected':''}>${esc(x)}</option>`).join('')}
  function syncType(){
    let v=type.value;
    document.querySelectorAll('[data-form-type]').forEach(b=>b.classList.toggle('active',b.dataset.formType===v));
    document.querySelector('#fromWrap').style.display=(v==='income'||v==='refund')?'none':'block';
    document.querySelector('#toWrap').style.display=(v==='income'||v==='refund'||v==='savings_transfer'||v==='internal_transfer')?'block':'none';
    if(v==='income'||v==='refund'){to.value='checking';cat.value='Revenus'}
    if(v==='bill' && cat.value==='Revenus')cat.value='Factures';
    if(v==='expense' && cat.value==='Revenus')cat.value='Dépenses';
    if(v==='savings_transfer'){from.value='checking';to.value='savings';if(cats.includes('Épargne'))cat.value='Épargne'}
    subs();
  }
  document.querySelectorAll('[data-form-type]').forEach(b=>b.onclick=()=>{type.value=b.dataset.formType;syncType()});
  cat.onchange=subs; type.onchange=syncType; subs(); syncType();
  document.querySelector('#fpoint').onchange=e=>document.querySelector('#pointLabel').textContent=e.target.checked?'Pointée':'À pointer';
  document.querySelector('#cancel').onclick=closeModal;
  document.querySelector('#ok').onclick=()=>{
    t.month=month;
    t.budgetMonth=+document.querySelector('#fbudgetmonth').value;
    t.day=Math.min(31,Math.max(1,+document.querySelector('#fday').value||new Date().getDate()));
    t.description=document.querySelector('#fdesc').value.trim();
    t.amount=Math.abs(+document.querySelector('#famount').value||0);
    t.type=type.value;
    t.fromAccount=(t.type==='income'||t.type==='refund')?null:from.value;
    t.toAccount=(t.type==='income'||t.type==='refund'||t.type==='savings_transfer'||t.type==='internal_transfer')?to.value:null;
    t.category=(t.type==='income'||t.type==='refund')?'Revenus':cat.value;
    t.subcategory=sub.value;
    t.pointed=document.querySelector('#fpoint').checked;
    normalizeMovement(t);
    if(!old)state.transactions.push(t);
    save(old?'modification mouvement':'ajout mouvement');closeModal();render();
    showToast(old?'Mouvement modifié':'Mouvement ajouté');
  };
  let dup=document.querySelector('#duplicate');if(dup)dup.onclick=()=>{const copy=cloneData(t);copy.id='u'+Date.now();copy.day=new Date().getDate();copy.pointed=false;state.transactions.push(copy);save('duplication mouvement');closeModal();render();showToast('Mouvement dupliqué')};
  let del=document.querySelector('#del');if(del)del.onclick=()=>{if(confirm('Supprimer ce mouvement ?')){state.transactions=state.transactions.filter(x=>x.id!==t.id);save('suppression mouvement');closeModal();render();showToast('Mouvement supprimé')}};
}
function showToast(message){let old=document.querySelector('.app-toast');if(old)old.remove();let el=document.createElement('div');el.className='app-toast';el.textContent=message+' ✓';document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),250)},1800)}
function closeModal(){document.querySelector('#modal').hidden=true;document.querySelector('#modal').innerHTML=''}
function exportData(){let b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='budget-2026-sauvegarde.json';a.click();URL.revokeObjectURL(a.href)}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();alert('Sauvegarde restaurée.');render()}catch{alert('Fichier de sauvegarde invalide.')}};r.readAsText(f)}
document.querySelectorAll('.bottom button').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;let b=document.querySelector('#installBtn');b.hidden=false;b.onclick=()=>deferredPrompt.prompt()});if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js?v=341').then(r=>r.update()).catch(()=>{});}ensureRecurringForMonth(month);render();
