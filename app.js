
const D=window.INITIAL_DATA, KEY='budget2026.test.v2', BACKUP_KEY='budget2026.test.backups', APP_VERSION='3.5.7-test', MAX_BACKUPS=5;
let state=load(), view='home', month=Math.max(0,Math.min(11,new Date().getFullYear()===2026?new Date().getMonth():0)), deferredPrompt=null;
let txStatusFilter='all', txTypeFilter='all', txSearch='', forecastTypeFilter='all', forecastRange='month', diagnosticResults=null;
function cloneData(v){return JSON.parse(JSON.stringify(v))}
function normalizeState(raw){const base=cloneData(D),defaults={shiftBills:true,shiftIncome:true,shiftSavings:true,useFrenchHolidays:true,expenseDelay:2};if(!raw||typeof raw!=='object')raw=base;return {...base,...raw,months:Array.isArray(raw.months)?raw.months:base.months,transactions:Array.isArray(raw.transactions)?raw.transactions:base.transactions,recurringBills:Array.isArray(raw.recurringBills)?raw.recurringBills.map(r=>({...r,type:r.type||'bill',fromAccount:r.fromAccount||'checking',toAccount:r.toAccount||(r.type==='savings_transfer'?'savings':null)})):[],recurringSkips:Array.isArray(raw.recurringSkips)?raw.recurringSkips:[],categories:raw.categories&&typeof raw.categories==='object'?raw.categories:base.categories,forecastSettings:{...defaults,...(raw.forecastSettings||{})},meta:{...(raw.meta||{}),appVersion:APP_VERSION,lastOpenedAt:new Date().toISOString()}}}
function readBackups(){try{return JSON.parse(localStorage.getItem(BACKUP_KEY))||[]}catch(e){return[]}}
function writeBackups(v){localStorage.setItem(BACKUP_KEY,JSON.stringify(v.slice(0,MAX_BACKUPS)))}
function createBackup(reason='automatique'){try{const raw=localStorage.getItem(KEY);if(!raw)return;const data=JSON.parse(raw),signature=JSON.stringify(data.transactions||[]);let b=readBackups();if(b[0]&&b[0].signature===signature)return;b.unshift({id:'b'+Date.now(),date:new Date().toISOString(),reason,signature,data});writeBackups(b)}catch(e){console.warn(e)}}
function load(){try{const raw=localStorage.getItem(KEY);return raw?normalizeState(JSON.parse(raw)):normalizeState(D)}catch(e){const b=readBackups();return b.length?normalizeState(b[0].data):normalizeState(D)}}
function isQuotaError(e){return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014)}
function freeStorageForSave(){
  try{
    let backups=readBackups();
    while(backups.length>2){backups.pop();try{writeBackups(backups)}catch(e){break}}
    if(backups.length>2)writeBackups(backups.slice(0,2));
  }catch(e){console.warn('Nettoyage des sauvegardes impossible',e)}
}
function save(reason='modification'){
  if(localStorage.getItem(KEY))createBackup(reason);
  state.meta={...(state.meta||{}),appVersion:APP_VERSION,lastSavedAt:new Date().toISOString()};
  const raw=JSON.stringify(state);
  try{localStorage.setItem(KEY,raw);return true}
  catch(e){
    if(isQuotaError(e)){
      freeStorageForSave();
      try{localStorage.setItem(KEY,raw);return true}catch(e2){
        try{localStorage.removeItem(BACKUP_KEY);localStorage.setItem(KEY,raw);return true}catch(e3){console.error(e3)}
    }}
    console.error(e);
    alert('Impossible d’enregistrer le mouvement. L’espace de stockage local est saturé. Une sauvegarde peut être exportée depuis Plus.');
    return false;
  }
}
function downloadBackup(){createBackup('export manuel');const blob=new Blob([JSON.stringify({format:'KerBudget Backup',version:APP_VERSION,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='KerBudget-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)}
function importBackupFile(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result),incoming=p.state||p;if(!Array.isArray(incoming.transactions))throw 0;createBackup('avant import');state=normalizeState(incoming);localStorage.setItem(KEY,JSON.stringify(state));render();alert('Sauvegarde importée.')}catch(e){alert('Fichier de sauvegarde invalide.')}};r.readAsText(file)}
function recoverLatestBackup(){const b=readBackups();if(!b.length){alert('Aucune sauvegarde disponible.');return}if(confirm('Restaurer la sauvegarde du '+new Date(b[0].date).toLocaleString('fr-FR')+' ?')){state=normalizeState(cloneData(b[0].data));localStorage.setItem(KEY,JSON.stringify(state));render();alert('Sauvegarde restaurée.')}}
migrateMovements();
window.addEventListener('beforeunload',()=>createBackup('fermeture'));
const euro=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
function budgetState(plannedAmount,actualAmount,isIncome=false){
  // Comparaison en centimes pour éviter qu'un écart invisible de flottants
  // transforme un budget exactement atteint en faux dépassement.
  const plannedCents=Math.max(0,Math.round((Number(plannedAmount)||0)*100));
  const actualCents=Math.max(0,Math.round((Number(actualAmount)||0)*100));
  const plannedValue=plannedCents/100,actualValue=actualCents/100;
  const diffCents=isIncome?actualCents-plannedCents:plannedCents-actualCents;
  const diff=diffCents/100;
  const pct=plannedCents>0?Math.max(0,actualCents/plannedCents*100):(actualCents>0?100:0);
  if(isIncome)return{level:'income',status:'Revenus',diff,pct};
  if(actualCents===0)return{level:'zero',status:'Budget non commencé',diff:plannedValue,pct:0};
  if(plannedCents===0)return{level:'danger',status:'Dépassé',diff:-actualValue,pct:100};
  if(actualCents===plannedCents)return{level:'reached',status:'Budget atteint',diff:0,pct:100};
  if(actualCents>plannedCents)return{level:'danger',status:'Dépassé',diff,pct};
  if(pct>=80)return{level:'warning',status:'À surveiller',diff,pct};
  return{level:'safe',status:'Dans le budget',diff,pct};
}
try{const cacheVersion='357';if(localStorage.getItem('kerbudget-cache-version')!==cacheVersion){localStorage.setItem('kerbudget-cache-version',cacheVersion);if('caches' in window)caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))));}}catch(e){}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function movementMonth(t){return Number.isInteger(t.budgetMonth)?t.budgetMonth:(Number.isInteger(t.month)?t.month:0)}
function mtx(i){return state.transactions.filter(t=>movementMonth(t)===i)}
function isSavingsTransfer(t){const s=((t.category||'')+' '+(t.subcategory||'')+' '+(t.description||'')).toLowerCase();return s.includes('épargne')||s.includes('epargne')||s.includes('livret a')}
function savingsOpening(){
  const rows=(window.KERBUDGET_EXCEL_EXTRA?.Epargne||[]);
  const row=rows.find(r=>r&&String(r[1]||'').toLowerCase().includes('solde précédent'));
  return Number(row?.[5] ?? row?.[3] ?? 0)||0;
}
function savingsTransfers(monthIndex=null,pointedOnly=true){
  return state.transactions.filter(t=>
    (monthIndex===null||movementMonth(t)===monthIndex)&&
    isSavingsType(t)&&
    (!pointedOnly||t.pointed)
  );
}
function savingsImpact(t){
  const amount=Math.abs(Number(t.amount)||0);
  if(t.fromAccount==='savings'&&t.toAccount!=='savings')return -amount;
  if(t.toAccount==='savings'&&t.fromAccount!=='savings')return amount;
  return 0;
}
function cashImpact(t){
  const amount=Math.abs(Number(t.amount)||0);
  if(isIncomeType(t))return amount;
  if(isExpenseType(t))return -amount;
  if(isSavingsType(t)){
    if(t.fromAccount==='checking'&&t.toAccount==='savings')return -amount;
    if(t.fromAccount==='savings'&&t.toAccount==='checking')return amount;
    return 0;
  }
  if(inferMovementType(t)==='internal_transfer')return 0;
  return -amount;
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
function cashTotals(i){let net=0,pnet=0,income=0,outflow=0,pincome=0,poutflow=0;for(const t of mtx(i)){const impact=cashImpact(t);net+=impact;if(t.pointed)pnet+=impact;if(impact>=0){income+=impact;if(t.pointed)pincome+=impact}else{outflow+=Math.abs(impact);if(t.pointed)poutflow+=Math.abs(impact)}}return{net,pnet,income,outflow,pincome,poutflow}}
function balance(i,pointed=true){let prev=i===0?state.months[0].openingBalance:balance(i-1,pointed),t=cashTotals(i);return prev+(pointed?t.pnet:t.net)}
function monthbar(){return `<div class="monthbar">${state.months.map((m,i)=>`<button data-month="${i}" class="${i===month?'active':''}">${m.month}</button>`).join('')}</div>`}
function layout(inner){return `<div class="wrap">${inner}</div>`}
function daysLeftInMonth(i){const n=new Date();if(n.getFullYear()!==2026||n.getMonth()!==i)return new Date(2026,i+1,0).getDate();return Math.max(1,new Date(2026,i+1,0).getDate()-n.getDate()+1)}
function billsPending(i){return mtx(i).filter(t=>inferMovementType(t)==='bill'&&!t.pointed)}
function unpointedMovements(i){return mtx(i).filter(t=>!t.pointed)}
function monthSavings(i){return savingsTransfers(i,true).reduce((s,t)=>s+savingsImpact(t),0)}
function monthMetrics(i){
  const txTotals=totals(i), plan=planned(i), cash=cashTotals(i), savings=monthSavings(i);
  const resultBeforeSavings=txTotals.income-txTotals.expense;
  const checkingVariation=resultBeforeSavings-savings;
  return {
    ...txTotals,
    plannedIncome:plan.income,
    plannedExpense:plan.expense,
    cashNet:cash.net,
    pointedCashNet:cash.pnet,
    savings,
    resultBeforeSavings,
    checkingVariation,
    projectedBalance:balance(i,false),
    pointedBalance:balance(i,true)
  };
}
function savingsGoal(){const r=(window.KERBUDGET_EXCEL_EXTRA?.Epargne||[]).find(x=>x&&String(x[1]||'').toLowerCase()==='total');return Number(r?.[2]||0)}
function dashboardStatus(i){const p=billsPending(i).length,b=balance(i,false);if(b<0)return{tone:'danger',icon:'🔴',text:'Attention, le solde prévisionnel est négatif.'};if(p>0)return{tone:'warning',icon:'🟠',text:`Il reste ${p} facture${p>1?'s':''} à pointer.`};return{tone:'success',icon:'🟢',text:'Tout est à jour.'}}
function incompleteMovements(i){return mtx(i).filter(t=>!(t.description||'').trim()||!(t.category||'').trim())}
function recurringToGenerate(i){return(state.recurringBills||[]).filter(r=>recurringDue(r,i)&&!state.transactions.some(t=>t.recurringKey===recurringKey(r,i)))}
function importantUpcoming(i){return forecastData(i).rows.slice(0,3)}
function budgetAlerts(i){const out=[],lines=state.months[i].budgetLines||[],plannedByCategory={},spentByCategory={};for(const l of lines){if(l.type!=='expense')continue;const k=(l.category||'Dépenses').trim();plannedByCategory[k]=(plannedByCategory[k]||0)+(Number(l.planned)||0)}for(const t of mtx(i).filter(t=>isExpenseType(t))){const k=(t.category||'Dépenses').trim();spentByCategory[k]=(spentByCategory[k]||0)+(Number(t.amount)||0)}for(const [category,planned] of Object.entries(plannedByCategory)){const spent=spentByCategory[category]||0,stateInfo=budgetState(planned,spent,false);if(stateInfo.level==='danger')out.push({tone:'danger',text:`${category} : budget dépassé de ${euro(Math.abs(stateInfo.diff))}`});else if(stateInfo.level==='warning'||stateInfo.level==='reached')out.push({tone:'warning',text:`${category} : ${stateInfo.level==='reached'?'budget atteint':stateInfo.pct.toFixed(0)+' % du budget utilisé'}`})}const projected=balance(i,false);if(projected<0)out.unshift({tone:'danger',text:`Solde prévisionnel négatif de ${euro(Math.abs(projected))}`});return out.slice(0,4)}
function currentDayForMonth(i){const n=new Date();return n.getFullYear()===2026&&n.getMonth()===i?n.getDate():1}
function easterSunday(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31)-1,day=(h+l-7*m+114)%31+1;return new Date(year,month,day)}
function frenchHolidays(year){const fixed=[[0,1],[4,1],[4,8],[6,14],[7,15],[10,1],[10,11],[11,25]],e=easterSunday(year),dates=fixed.map(([m,d])=>new Date(year,m,d));for(const offset of [1,39,50]){const x=new Date(e);x.setDate(x.getDate()+offset);dates.push(x)}return new Set(dates.map(d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`))}
function isBusinessDay(date){if(date.getDay()===0||date.getDay()===6)return false;if(state.forecastSettings?.useFrenchHolidays){const h=frenchHolidays(date.getFullYear());if(h.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`))return false}return true}
function nextBusinessDay(date){const d=new Date(date);while(!isBusinessDay(d))d.setDate(d.getDate()+1);return d}
function addBusinessDays(date,count){const d=new Date(date);let left=Math.max(0,Number(count)||0);while(left>0){d.setDate(d.getDate()+1);if(isBusinessDay(d))left--}return d}
function forecastDateForMovement(t){const year=2026,baseMonth=movementMonth(t),last=new Date(year,baseMonth+1,0).getDate(),base=new Date(year,baseMonth,Math.min(last,Math.max(1,Number(t.day)||1))),type=inferMovementType(t),cfg=state.forecastSettings||{};let d=new Date(base),estimated=false,shifted=false;const now=new Date();now.setHours(0,0,0,0);if(type==='expense'&&!t.pointed&&Number(cfg.expenseDelay)>0&&base<now){d=addBusinessDays(now,Number(cfg.expenseDelay));estimated=true}else{const shouldShift=(type==='bill'&&cfg.shiftBills)||(isIncomeType(t)&&cfg.shiftIncome)||(type==='savings_transfer'&&cfg.shiftSavings);if(shouldShift&&!isBusinessDay(d)){d=nextBusinessDay(d);shifted=true}}return{date:d,estimated,shifted}}

function upcomingWithinDays(i,days=7){const from=currentDayForMonth(i),to=Math.min(new Date(2026,i+1,0).getDate(),from+days-1);return forecastData(i).rows.filter(x=>x.day>=from&&x.day<=to)}
function smartInsights(i){
  const out=[], f=forecastData(i);
  if(f.ending<0)out.push({tone:'danger',icon:'−',text:`Le solde prévisionnel de fin de mois est négatif de ${euro(Math.abs(f.ending))}.`,go:'forecast'});
  return out
}
function navigateTo(target){view=target;render();window.scrollTo({top:0,behavior:'auto'})}
window.navigateTo=navigateTo;
function home(){
  const current=balance(month,true), f=forecastData(month), savingsTotal=savingsBalance(), pending=unpointedMovements(month), week=upcomingWithinDays(month,7), weekOut=week.filter(x=>x.amount<0).reduce((s,x)=>s+Math.abs(x.amount),0), upcoming=f.rows.slice(0,5), insights=smartInsights(month), t=totals(month), p=planned(month), budgetInfo=budgetState(p.expense,t.expense,false), budgetUsed=Math.min(100,budgetInfo.pct);
  return layout(`${monthbar()}
    <section class="today-head"><div><span>Aujourd’hui</span><h2>${state.months[month].month} 2026</h2><small>Ta situation essentielle en un coup d’œil.</small></div><button class="today-add" data-add>+</button></section>
    <section class="today-grid">
      <button class="today-card main" data-go="forecast"><span class="today-icon">€</span><small>Disponible actuel</small><strong>${euro(current)}</strong><em>Fin de mois : ${euro(f.ending)}</em></button>
      <button class="today-card pending" data-go="transactions"><span class="today-icon">✓</span><small>À pointer</small><strong>${pending.length}</strong><em>Impact net ${euro(pending.reduce((s,x)=>s+cashImpact(x),0))}</em></button>
      <button class="today-card upcoming" data-go="forecast"><span class="today-icon">7j</span><small>Sorties à 7 jours</small><strong>${euro(weekOut)}</strong><em>${week.filter(x=>x.amount<0).length} opération${week.filter(x=>x.amount<0).length>1?'s':''}</em></button>
      <button type="button" class="today-card savings" data-go="savings"><span class="today-icon">◆</span><small>Épargne totale</small><strong>${euro(savingsTotal)}</strong><em>Virements pointés</em></button>
    </section>
    <section class="today-section">
      <div class="today-section-head"><div><span>Prochainement</span><h3>Les 5 prochaines opérations</h3></div><button data-go="forecast">Tout voir</button></div>
      ${upcoming.length?`<div class="today-upcoming">${upcoming.map(x=>`<div class="today-operation" ${x.source==='movement'?`data-edit="${esc(x.id)}"`:''}><div class="today-date"><b>${String(x.day).padStart(2,'0')}</b><span>${state.months[month].month.slice(0,3)}</span></div><div><strong>${esc(x.title)}${x.recurring?'<span class="recurring-badge" title="Mouvement récurrent">↻</span>':''}</strong><small>Solde après : ${euro(x.balanceAfter)}</small></div><b class="${x.amount>=0?'positive':'negative'}">${x.amount>=0?'+':'−'}${euro(Math.abs(x.amount))}</b></div>`).join('')}</div>`:'<div class="empty">Aucune opération à venir.</div>'}
    </section>
    ${insights.length?`<section class="today-section">
      <div class="today-section-head"><div><span>Analyse</span><h3>À retenir ce mois-ci</h3></div></div>
      <div class="insight-list">${insights.map(a=>`<button class="insight ${a.tone}" data-go="${a.go}"><i>${a.icon}</i><span>${esc(a.text)}</span><b>›</b></button>`).join('')}</div>
    </section>`:''}
    <section class="today-budget budget-${budgetInfo.level}" data-go="budget"><div><span>Budget dépenses</span><strong>${euro(t.expense)} <small>/ ${euro(p.expense)}</small></strong></div><b>${budgetUsed.toFixed(0)} %</b><div class="progress"><i style="width:${budgetUsed}%"></i></div></section>
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
function recurringBadge(t){return t&&t.recurringKey?'<span class="recurring-badge" title="Mouvement récurrent" aria-label="Mouvement récurrent">↻</span>':''}
function pointageRow(t){
  normalizeMovement(t);
  const positive=isIncomeType(t),flow=t.fromAccount&&t.toAccount?`${accountLabel(t.fromAccount)} → ${accountLabel(t.toAccount)}`:'';
  const meta=[t.day?String(t.day).padStart(2,'0')+'/'+String(t.month+1).padStart(2,'0')+'/2026':'2026',typeLabel(t.type),t.subcategory,flow].filter(Boolean).join(' · ');
  return `<article class="movement-card ${t.pointed?'is-pointed':'is-pending'}" data-edit="${esc(t.id)}">
    <div class="movement-icon type-${transactionTypeGroup(t)}">${movementIcon(t)}</div>
    <div class="movement-main"><div class="movement-top"><strong>${esc(t.description||t.subcategory||'Mouvement')}${recurringBadge(t)}</strong><span class="movement-status ${t.pointed?'done':'todo'}">${t.pointed?'Pointé':'À pointer'}</span></div><small>${esc(meta)}</small></div>
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
  const pendingAmount=pending.reduce((s,t)=>s+cashImpact(t),0);
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
    ${pending.length?`<div class="pointage-footer"><span>${pending.length} mouvement${pending.length>1?'s':''} à pointer</span><strong>Impact net ${euro(pendingAmount)}</strong></div>`:''}
  `);
}
function budget(){
  const lines=state.months[month].budgetLines||[], tx=mtx(month), p=planned(month), t=totals(month);
  const groups={};
  for(const line of lines){const key=line.type==='income'?'Revenus':line.category;(groups[key]??=[]).push(line)}
  const expenseActual=t.expense, incomeActual=t.income;
  const expenseRemaining=p.expense-expenseActual, incomeGap=incomeActual-p.income;
  const overallBudget=budgetState(p.expense,expenseActual,false), used=overallBudget.pct;
  const groupActual=(name,isIncome)=>tx.filter(x=>isIncome?isIncomeType(x)&&x.category.trim()==='Revenus':isExpenseType(x)&&x.category.trim()===name.trim()).reduce((a,b)=>a+(Number(b.amount)||0),0);
  const cards=`<section class="budget-overview">
    <div class="budget-kpi primary budget-${overallBudget.level}"><span>Budget prévu</span><strong>${euro(p.expense)}</strong><small>${used.toFixed(0)} % consommé</small><div class="progress"><i style="width:${Math.min(100,used)}%"></i></div></div>
    <div class="budget-kpi"><span>Dépensé</span><strong class="negative">${euro(expenseActual)}</strong><small>Dépenses réelles du mois</small></div>
    <div class="budget-kpi"><span>Disponible</span><strong class="${expenseRemaining>=0?'positive':'negative'}">${euro(expenseRemaining)}</strong><small>${expenseRemaining>=0?'Encore disponible':'Budget dépassé'}</small></div>
    <div class="budget-kpi"><span>Écart revenus</span><strong class="${incomeGap>=0?'positive':'negative'}">${incomeGap>=0?'+':'−'} ${euro(Math.abs(incomeGap))}</strong><small>${euro(incomeActual)} reçu sur ${euro(p.income)} prévu</small></div>
  </section>`;
  const prepared=Object.entries(groups).map(([name,items])=>{
    const isIncome=name==='Revenus', plannedTotal=items.reduce((sum,x)=>sum+(Number(x.planned)||0),0), actual=groupActual(name,isIncome), info=budgetState(plannedTotal,actual,isIncome);
    const rank=isIncome?5:info.level==='danger'?0:info.level==='warning'?1:info.level==='reached'?2:info.level==='safe'?3:4;
    return{name,items,isIncome,plannedTotal,actual,diff:info.diff,pct:info.pct,level:info.level,status:info.status,rank};
  }).sort((a,b)=>a.rank-b.rank||(b.pct-a.pct)||a.name.localeCompare(b.name,'fr'));
  const body=prepared.map(g=>{
    const status=g.status;
    return `<section class="budget-group budget-${g.level} ${g.isIncome?'income-group':''}">
      <div class="budget-group-head"><div><div class="budget-heading-line"><h3>${esc(g.name)}</h3><span class="budget-status">${status}</span></div><small>${g.items.length} poste${g.items.length>1?'s':''}</small></div><div class="budget-group-totals"><span>Prévu <b>${euro(g.plannedTotal)}</b></span><span>Dépensé <b>${euro(g.actual)}</b></span></div></div>
      <div class="budget-progress"><div class="progress"><i style="width:${Math.min(100,g.pct)}%"></i></div><div class="budget-progress-line"><small>${g.pct.toFixed(0)} % consommé</small><small class="${g.diff>=0?'positive':'negative'}">${g.isIncome?(g.diff>=0?'Au-dessus de ':'Sous le prévu de '):(g.level==='reached'?'Budget atteint':g.diff>=0?'Reste ':'Dépassé de ')}${g.level==='reached'?'':euro(Math.abs(g.diff))}</small></div></div>
      <div class="budget-lines">${g.items.map(line=>{const gi=lines.indexOf(line);return `<label class="budget-line"><span><b>${esc(line.label)}</b><small>${g.isIncome?'Revenu prévu':'Montant prévu'}</small></span><div class="budget-input"><input aria-label="Montant prévu pour ${esc(line.label)}" type="number" step="0.01" value="${line.planned}" data-budget="${gi}"><em>€</em></div></label>`}).join('')}</div>
    </section>`
  }).join('');
  return layout(`${monthbar()}<div class="section-title budget-title"><div><h2>Budget • ${state.months[month].month}</h2><small>Les catégories prioritaires sont affichées en premier.</small></div><button class="btn secondary" data-go="home">Terminé</button></div>${cards}<div class="budget-legend"><span><i class="safe"></i>Moins de 80 %</span><span><i class="warning"></i>80 à 99 %</span><span><i class="danger"></i>Dépassé</span></div><div class="budget-groups">${body}</div>`)
}
function annual(){
  const arr=state.months.map((m,i)=>{
    const x=monthMetrics(i);
    return{m:m.month.slice(0,3),name:m.month,inc:x.income,exp:x.expense,planned:x.plannedExpense,savings:x.savings,result:x.resultBeforeSavings,checkingVariation:x.checkingVariation};
  });
  const inc=arr.reduce((a,b)=>a+b.inc,0),exp=arr.reduce((a,b)=>a+b.exp,0),sav=arr.reduce((a,b)=>a+b.savings,0),result=inc-exp,checkingVariation=result-sav;
  const mx=Math.max(...arr.map(x=>Math.abs(x.checkingVariation)),1);
  return layout(`<div class="section-title annual-title"><div><h2>Synthèse annuelle 2026</h2><small>Vue synthétique des douze mois. Touchez un mois pour consulter ses mouvements.</small></div></div>
    <section class="annual-kpis annual-kpis-four">
      <div class="annual-kpi"><span>Revenus annuels</span><strong class="positive">${euro(inc)}</strong></div>
      <div class="annual-kpi"><span>Dépenses annuelles</span><strong class="negative">${euro(exp)}</strong></div>
      <div class="annual-kpi"><span>Épargne nette</span><strong class="${sav>=0?'positive':'negative'}">${sav>=0?'+':'−'}${euro(Math.abs(sav))}</strong></div>
      <div class="annual-kpi main"><span>Variation du compte courant</span><strong class="${checkingVariation>=0?'positive':'negative'}">${euro(checkingVariation)}</strong><small>Revenus − dépenses − épargne nette</small></div>
    </section>
    <section class="annual-chart-card"><div class="cap">ÉVOLUTION DU COMPTE COURANT</div><div class="annual-chart-scroll"><div class="chart annual-chart">${arr.map(x=>`<div class="barcol"><b class="annual-bar-value ${x.checkingVariation>=0?'positive':'negative'}">${Math.round(x.checkingVariation)} €</b><div class="bar ${x.checkingVariation<0?'neg':''}" style="height:${Math.max(3,Math.abs(x.checkingVariation)/mx*130)}px"></div><span>${x.m}</span></div>`).join('')}</div></div></section>
    <div class="section-title"><h2>Mois par mois</h2></div>
    <div class="annual-months">${arr.map((x,i)=>`<details class="annual-month-card" ${i===month?'open':''}>
      <summary><span><strong>${x.name}</strong><small>${x.checkingVariation>=0?'Variation positive':'Variation négative'}</small></span><b class="${x.checkingVariation>=0?'positive':'negative'}">${euro(x.checkingVariation)}</b></summary>
      <div class="annual-month-data annual-month-data-four"><span>Revenus <b class="positive">${euro(x.inc)}</b></span><span>Dépenses <b class="negative">${euro(x.exp)}</b></span><span>Épargne nette <b class="${x.savings>=0?'positive':'negative'}">${x.savings>=0?'+':'−'}${euro(Math.abs(x.savings))}</b></span><span>Résultat hors épargne <b class="${x.result>=0?'positive':'negative'}">${euro(x.result)}</b></span></div>
      <button type="button" class="btn secondary annual-open-month" data-monthgo="${i}">Voir les mouvements de ${x.name}</button>
    </details>`).join('')}</div>`)
}

function txList(items){
  if(!items||!items.length)return '<div class="empty">Aucune opération.</div>';
  return `<div class="list">${items.map(t=>{
    const positive=isIncomeType(t);
    const date=t.day?`${String(t.day).padStart(2,'0')}/${String((Number.isInteger(t.month)?t.month:month)+1).padStart(2,'0')}/2026`:'Date non renseignée';
    return `<button type="button" class="row" data-edit="${esc(t.id)}"><div><div class="title">${esc(t.description||t.subcategory||'Mouvement')}${recurringBadge(t)}</div><div class="sub">${esc(date)} · ${esc(t.subcategory||t.category||'Sans catégorie')}</div></div><div class="amount ${positive?'positive':'negative'}">${positive?'+':'−'}${euro(Math.abs(Number(t.amount)||0))}</div></button>`;
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
      <span class="savings-movement-main"><strong>${esc(t.description||direction)}${recurringBadge(t)}</strong><small>${esc(date)} · ${esc(account)} · ${esc(direction)}</small></span>
      <span class="savings-movement-side"><b class="${impact>=0?'positive':'negative'}">${impact>=0?'+':'−'}${euro(Math.abs(impact))}</b><em>${t.pointed?'Pointé':'À pointer'}</em></span>
    </button>`;
  }).join('')}</div>`;
}
function savings(){
  const opening=savingsOpening();
  const allTransfers=savingsTransfers(null,false).slice().sort((a,b)=>(movementMonth(b)-movementMonth(a))||((b.day||0)-(a.day||0)));
  const pointed=allTransfers.filter(t=>t.pointed);
  const unpointed=allTransfers.filter(t=>!t.pointed);
  const deposits=pointed.filter(t=>savingsImpact(t)>=0).reduce((s,t)=>s+savingsImpact(t),0);
  const withdrawals=Math.abs(pointed.filter(t=>savingsImpact(t)<0).reduce((s,t)=>s+savingsImpact(t),0));
  const annual=pointed.reduce((s,t)=>s+savingsImpact(t),0);
  const current=opening+annual;
  const estimated=current+unpointed.reduce((s,t)=>s+savingsImpact(t),0);
  const monthTransfers=allTransfers.filter(t=>movementMonth(t)===month);
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
    <div class="section-title"><h2>Tous les mouvements d’épargne</h2><div class="section-actions"><span class="pill">${allTransfers.length}</span><button class="btn secondary" data-go="savings-recurring">Virements récurrents</button></div></div>
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
  let created=0,bills=0,savings=0;
  for(const r of state.recurringBills||[]){
    if(!recurringDue(r,m))continue;
    const key=recurringKey(r,m);
    if(state.transactions.some(t=>t.recurringKey===key)||(state.recurringSkips||[]).includes(key))continue;
    const recurringType=r.type||'bill',isSavings=recurringType==='savings_transfer';
    state.transactions.push(normalizeMovement({
      id:'rec-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
      month:m,budgetMonth:m,day:Math.min(31,Math.max(1,Number(r.day)||1)),
      description:r.name,amount:Number(r.amount)||0,category:r.category||(isSavings?'Épargne':'Dépenses'),
      subcategory:r.subcategory||'',pointed:false,type:recurringType,
      fromAccount:isSavings?(r.fromAccount||'checking'):'checking',toAccount:isSavings?(r.toAccount||'savings'):null,
      recurringId:r.id,recurringKey:key
    }));
    created++;if(isSavings)savings++;else bills++;
  }
  if(created){
    save('génération opérations récurrentes');
    if(notify){const parts=[];if(bills)parts.push(`${bills} facture${bills>1?'s':''}`);if(savings)parts.push(`${savings} virement${savings>1?'s':''} d’épargne`);alert(parts.join(' et ')+' généré'+(created>1?'s':'')+'.')}
  } else if(notify)alert('Aucune nouvelle opération récurrente à générer pour ce mois.');
  return created;
}
function recurring(){
  const list=(state.recurringBills||[]).filter(r=>(r.type||'bill')!=='savings_transfer').slice().sort((a,b)=>(a.day||1)-(b.day||1));
  return layout(`${monthbar()}
    <div class="section-title"><div><h2>Factures récurrentes</h2><small>Prélèvements et factures automatiques.</small></div><button class="btn" data-recurring-add data-recurring-kind="bill">+ Facture</button></div>
    <div class="recurring-actions"><button class="btn secondary" data-recurring-generate>Générer pour ${state.months[month].month}</button></div>
    <div class="list recurring-list">${list.length?list.map(r=>`<button type="button" class="recurring-card" data-recurring-edit="${esc(r.id)}" data-recurring-kind="bill">
        <span class="recurring-icon">▤</span>
        <span class="recurring-copy"><b>${r.active?'':'⏸ '}${esc(r.name)}</b><small>Le ${r.day} · ${(RECUR_FREQ.find(f=>f.id===r.frequency)||{}).label||'Mensuelle'} · ${esc(r.category||'')}</small></span>
        <strong class="negative">−${euro(r.amount)}</strong>
      </button>`).join(''):'<div class="empty">Aucune facture récurrente.</div>'}</div>`);
}
function savingsRecurring(){
  const list=(state.recurringBills||[]).filter(r=>(r.type||'bill')==='savings_transfer').slice().sort((a,b)=>(a.day||1)-(b.day||1));
  return layout(`${monthbar()}
    <div class="section-title"><div><h2>Virements d’épargne récurrents</h2><small>Planifie séparément les versements et retraits de ton épargne.</small></div><button class="btn" data-recurring-add data-recurring-kind="savings_transfer">+ Virement</button></div>
    <div class="recurring-actions"><button class="btn secondary" data-recurring-generate>Générer pour ${state.months[month].month}</button></div>
    <div class="list recurring-list">${list.length?list.map(r=>{
      const deposit=(r.fromAccount||'checking')!=='savings';
      return `<button type="button" class="recurring-card" data-recurring-edit="${esc(r.id)}" data-recurring-kind="savings_transfer">
        <span class="recurring-icon savings">◆</span>
        <span class="recurring-copy"><b>${r.active?'':'⏸ '}${esc(r.name)}</b><small>Le ${r.day} · ${(RECUR_FREQ.find(f=>f.id===r.frequency)||{}).label||'Mensuelle'} · ${accountLabel(r.fromAccount||'checking')} → ${accountLabel(r.toAccount||'savings')}</small></span>
        <strong class="${deposit?'positive':'negative'}">${deposit?'+':'−'}${euro(r.amount)}</strong>
      </button>`}).join(''):'<div class="empty">Aucun virement d’épargne récurrent.</div>'}</div>`);
}
function editRecurring(id,presetType=null){
  const old=id?(state.recurringBills||[]).find(x=>x.id===id):null;
  const r=old||{id:'rb'+Date.now(),type:presetType||'bill',name:'',amount:0,category:'Habitation',subcategory:'',day:1,frequency:'monthly',startMonth:0,endMonth:11,active:true,variable:false,fromAccount:'checking',toAccount:'savings'};
  r.type=r.type||presetType||'bill';
  const isSavingsModule=r.type==='savings_transfer';
  const moduleLabel=isSavingsModule?'virement d’épargne récurrent':'facture récurrente';
  const cats=Object.keys(state.categories);
  document.querySelector('#modal').hidden=false;
  document.querySelector('#modal').innerHTML=`<div class="sheet recurring-sheet"><div class="form-head"><div><span>${old?'MODIFICATION':'NOUVEAU'}</span><h2>${old?'Modifier':'Nouveau'} ${moduleLabel}</h2></div><button class="sheet-close" id="rcancel" aria-label="Fermer">×</button></div>
    <div class="recurring-context ${isSavingsModule?'savings':''}"><span>${isSavingsModule?'◆':'▤'}</span><div><b>${isSavingsModule?'Épargne':'Facture'}</b><small>${isSavingsModule?'Ce virement reste séparé des factures.':'Cette opération compte comme une facture.'}</small></div></div>
    <input id="rtype" type="hidden" value="${esc(r.type)}">
    <div class="field primary-field"><label>Nom</label><input id="rname" value="${esc(r.name)}" placeholder="Ex. EDF ou Virement Livret A"></div>
    <div class="amount-field"><label>Montant</label><div><input id="ramount" type="number" inputmode="decimal" step="0.01" min="0" value="${Math.abs(Number(r.amount)||0)}"><span>€</span></div></div>
    <div class="form-grid two"><div class="field"><label>Jour d’échéance</label><input id="rday" type="number" inputmode="numeric" min="1" max="31" value="${r.day}"></div><div class="field"><label>Fréquence</label><select id="rfreq">${RECUR_FREQ.map(f=>`<option value="${f.id}" ${f.id===r.frequency?'selected':''}>${f.label}</option>`).join('')}</select></div></div>
    <div class="form-grid two"><div class="field"><label>Début</label><select id="rstart">${state.months.map((m,i)=>`<option value="${i}" ${i===r.startMonth?'selected':''}>${m.month}</option>`).join('')}</select></div><div class="field"><label>Fin</label><select id="rend">${state.months.map((m,i)=>`<option value="${i}" ${i===r.endMonth?'selected':''}>${m.month}</option>`).join('')}</select></div></div>
    <div id="rbillFields"><div class="field"><label>Catégorie</label><select id="rcat">${cats.map(c=>`<option ${c===r.category?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Sous-catégorie</label><select id="rsub"></select></div><label class="check"><input id="rvariable" type="checkbox" ${r.variable?'checked':''}> Montant variable</label></div>
    <div id="rsavingsFields"><div class="field"><label>Compte de départ</label><select id="rfrom">${ACCOUNTS.map(x=>`<option value="${x.id}" ${x.id===(r.fromAccount||'checking')?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div><div class="field"><label>Compte d’arrivée</label><select id="rto">${ACCOUNTS.map(x=>`<option value="${x.id}" ${x.id===(r.toAccount||'savings')?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div><p class="form-note">Le virement sera créé à la date choisie et apparaîtra dans À venir puis dans Épargne.</p></div>
    <label class="point-switch"><div><b>Opération active</b><small>Générée automatiquement selon la fréquence</small></div><span class="switch"><input id="ractive" type="checkbox" ${r.active?'checked':''}><span></span></span></label>
    ${old?'<div class="secondary-actions"><button class="btn danger" id="rdel">Supprimer</button></div>':''}<div class="form-save"><button class="btn" id="rok">Enregistrer</button></div></div>`;
  const cat=document.querySelector('#rcat'),sub=document.querySelector('#rsub'),type=document.querySelector('#rtype');
  function fillSubs(){if(!cat||!sub)return;const ls=state.categories[cat.value]||[];sub.innerHTML='<option value="">—</option>'+ls.map(x=>`<option ${x===r.subcategory?'selected':''}>${esc(x)}</option>`).join('')}
  function syncRecurringType(){const savings=type.value==='savings_transfer';document.querySelector('#rbillFields').hidden=savings;document.querySelector('#rsavingsFields').hidden=!savings}
  if(cat){cat.onchange=fillSubs;fillSubs()}syncRecurringType();
  document.querySelector('#rcancel').onclick=closeModal;
  document.querySelector('#rok').onclick=()=>{
    const start=+document.querySelector('#rstart').value,end=+document.querySelector('#rend').value;
    if(end<start){alert('La date de fin doit être après la date de début.');return}
    r.name=document.querySelector('#rname').value.trim();if(!r.name){alert('Indique un nom.');return}
    r.type=type.value;r.amount=Math.abs(+document.querySelector('#ramount').value||0);r.day=Math.min(31,Math.max(1,+document.querySelector('#rday').value||1));r.frequency=document.querySelector('#rfreq').value;r.startMonth=start;r.endMonth=end;r.active=document.querySelector('#ractive').checked;
    if(r.type==='savings_transfer'){
      r.fromAccount=document.querySelector('#rfrom').value;r.toAccount=document.querySelector('#rto').value;
      if(r.fromAccount===r.toAccount){alert('Le compte de départ et le compte d’arrivée doivent être différents.');return}
      r.category='Épargne';r.subcategory='';r.variable=false;
    }else{
      r.category=cat.value;r.subcategory=sub.value;r.variable=document.querySelector('#rvariable').checked;r.fromAccount='checking';r.toAccount=null;
    }
    if(!old)state.recurringBills.push(r);save('opération récurrente');closeModal();render();showToast('Opération récurrente enregistrée')
  };
  const del=document.querySelector('#rdel');if(del)del.onclick=()=>{if(confirm('Supprimer cette opération récurrente ? Les mouvements déjà générés resteront conservés.')){state.recurringBills=state.recurringBills.filter(x=>x.id!==r.id);save('suppression opération récurrente');closeModal();render();showToast('Opération récurrente supprimée')}};
}
function monthReport(i){
  const x=monthMetrics(i),t={income:x.income,expense:x.expense,pincome:x.pincome,pexpense:x.pexpense},p={income:x.plannedIncome,expense:x.plannedExpense},pending=mtx(i).filter(m=>!m.pointed),prev=i>0?monthMetrics(i-1):null,cats={};
  for(const m of mtx(i).filter(m=>isExpenseType(m))){const name=(m.category||'Sans catégorie').trim()||'Sans catégorie';cats[name]=(cats[name]||0)+Number(m.amount||0)}
  const diff=(a,b)=>({value:a-b,pct:b?((a-b)/b*100):0});
  return{t,p,pending,prev,savings:x.savings,result:x.checkingVariation,categories:Object.entries(cats).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'fr')),incomeDiff:prev?diff(x.income,prev.income):null,expenseDiff:prev?diff(x.expense,prev.expense):null}
}
function diffBadge(d,invert=false){if(!d)return'<span class="trend neutral">Premier mois</span>';const good=invert?d.value<=0:d.value>=0;return`<span class="trend ${good?'good':'bad'}">${d.value>=0?'+':''}${euro(d.value)} · ${d.pct>=0?'+':''}${d.pct.toFixed(0)} %</span>`}
function reportPendingList(items){return `<div class="report-pending-list">${items.map(t=>{const date=`${String(t.day||1).padStart(2,'0')}/${String(movementMonth(t)+1).padStart(2,'0')}/2026`;return `<button type="button" class="report-pending-card" data-edit="${esc(t.id)}"><span class="report-pending-icon">${inferMovementType(t)==='bill'?'▤':'−'}</span><span><b>${esc(t.description||t.subcategory||'Mouvement')}${recurringBadge(t)}</b><small>${date} · ${esc(t.subcategory||t.category||'Sans catégorie')}</small></span><strong class="negative">−${euro(Math.abs(Number(t.amount)||0))}</strong></button>`}).join('')}</div>`}
function monthlyReport(){
  const r=monthReport(month),status=r.pending.length?'Provisoire':'À jour',max=Math.max(...r.categories.map(x=>x[1]),1);
  return layout(`${monthbar()}<div class="section-title report-title"><div><h2>Bilan • ${state.months[month].month}</h2><small>Vue complète du mois, avec toutes les catégories utilisées.</small></div><span class="report-status ${r.pending.length?'provisional':'ready'}">${status}</span></div>
    <div class="report-grid"><section class="report-card"><span>Revenus</span><strong class="positive">${euro(r.t.income)}</strong>${diffBadge(r.incomeDiff)}</section><section class="report-card"><span>Dépenses réelles</span><strong class="negative">${euro(r.t.expense)}</strong>${diffBadge(r.expenseDiff,true)}</section><section class="report-card"><span>Épargne nette</span><strong class="${r.savings>=0?'positive':'negative'}">${r.savings>=0?'+':'−'}${euro(Math.abs(r.savings))}</strong><small>Virements pointés</small></section><section class="report-card highlight"><span>Variation du compte courant</span><strong class="${r.result>=0?'positive':'negative'}">${euro(r.result)}</strong><small>Revenus − dépenses − épargne nette</small></section></div>
    <div class="section-title"><h2>Situation du mois</h2></div><section class="report-summary"><div><span>Budget prévu</span><b>${euro(r.p.expense)}</b></div><div><span>Dépenses pointées</span><b>${euro(r.t.pexpense)}</b></div><div><span>Reste sur budget</span><b class="${r.p.expense-r.t.expense>=0?'positive':'negative'}">${euro(r.p.expense-r.t.expense)}</b></div><div><span>Opérations non pointées</span><b>${r.pending.length}</b></div></section>
    ${r.pending.length?`<div class="section-title"><h2>Encore à pointer</h2><button class="btn secondary" data-go="transactions">Voir tout</button></div>${reportPendingList(r.pending.slice(0,6))}`:''}
    <div class="section-title"><div><h2>Dépenses par catégorie</h2><small>${r.categories.length} catégorie${r.categories.length>1?'s':''} utilisée${r.categories.length>1?'s':''} ce mois-ci</small></div></div>
    <section class="report-category-list">${r.categories.length?r.categories.map(([c,v])=>`<div class="report-category-row"><span><b>${esc(c)}</b><small>${(v/(r.t.expense||1)*100).toFixed(1)} % des dépenses</small></span><strong>${euro(v)}</strong><div class="progress"><i style="width:${Math.min(100,v/max*100)}%"></i></div></div>`).join(''):'<div class="empty">Aucune dépense ce mois-ci.</div>'}</section>`)
}

function forecastEvents(i){
  const events=[];
  for(const t of state.transactions.filter(t=>!t.pointed)){
    normalizeMovement(t);
    const planned=forecastDateForMovement(t);
    if(planned.date.getFullYear()!==2026||planned.date.getMonth()!==i)continue;
    const type=inferMovementType(t),isIncome=isIncomeType(t);
    events.push({
      id:t.id,day:planned.date.getDate(),title:t.description||t.subcategory||typeLabel(type)||'Mouvement',amount:cashImpact(t),
      kind:isIncome?'income':(type==='savings_transfer'?'savings':type==='bill'?'bill':'expense'),source:'movement',recurring:!!t.recurringKey,estimated:planned.estimated,shifted:planned.shifted
    });
  }
  for(const r of state.recurringBills||[]){
    for(const sourceMonth of [i-1,i]){
      if(sourceMonth<0||!recurringDue(r,sourceMonth))continue;
      const key=recurringKey(r,sourceMonth);
      if(state.transactions.some(t=>t.recurringKey===key)||(state.recurringSkips||[]).includes(key))continue;
      let d=new Date(2026,sourceMonth,Math.min(new Date(2026,sourceMonth+1,0).getDate(),Math.max(1,Number(r.day)||1))),shifted=false;
      const shiftRecurring=(r.type||'bill')==='savings_transfer'?state.forecastSettings?.shiftSavings:state.forecastSettings?.shiftBills;if(shiftRecurring&&!isBusinessDay(d)){d=nextBusinessDay(d);shifted=true}
      if(d.getMonth()!==i||d.getFullYear()!==2026)continue;
      const isSavings=(r.type||'bill')==='savings_transfer',impact=isSavings?(r.fromAccount==='savings'?Math.abs(Number(r.amount)||0):-Math.abs(Number(r.amount)||0)):-Math.abs(Number(r.amount)||0);events.push({id:'planned-'+key,day:d.getDate(),title:r.name,amount:impact,kind:isSavings?'savings':'planned',source:'recurring',recurring:true,shifted,estimated:false});
    }
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
  let running=all.opening,min=running,totalIncome=0,totalOut=0;
  const fullRange=all.rows.filter(e=>e.day>=from&&e.day<=to).map(e=>{
    running+=e.amount;min=Math.min(min,running);if(e.amount>=0)totalIncome+=e.amount;else totalOut+=Math.abs(e.amount);return{...e,balanceAfter:running};
  });
  const selected=fullRange.filter(e=>forecastTypeMatches(e,forecastTypeFilter));
  const groups=[];
  for(const e of selected){const label=forecastPeriodLabel(e.day,from,lastDay);let g=groups.find(x=>x.label===label);if(!g){g={label,rows:[],total:0};groups.push(g)}g.rows.push(e);g.total+=e.amount}
  const ending=running;
  const alert=min<0?{tone:'danger',icon:'🔴',text:`Découvert prévisionnel : ${euro(min)}`}:min<200?{tone:'warning',icon:'🟠',text:`Solde minimum faible : ${euro(min)}`}:{tone:'success',icon:'🟢',text:'Aucune période de découvert prévue.'};
  const typeFilters=[['all','Tous'],['income','Revenus'],['bill','Factures'],['expense','Dépenses'],['savings','Épargne']];
  const rangeFilters=[['7','7 jours'],['15','15 jours'],['month','Fin du mois']];
  return layout(`${monthbar()}
    <div class="section-title forecast-title"><div><h2>À venir • ${state.months[month].month}</h2><small>Prévision complète du compte. Les filtres modifient seulement la chronologie affichée.</small></div></div>
    <section class="forecast-alert ${alert.tone}"><span>${alert.icon}</span><strong>${alert.text}</strong></section>
    <div class="forecast-cards forecast-summary">
      <div><span>Solde actuel</span><b>${euro(all.opening)}</b></div>
      <div><span>Revenus prévus</span><b class="positive">+${euro(totalIncome)}</b></div>
      <div><span>Sorties prévues</span><b class="negative">−${euro(totalOut)}</b></div>
      <div><span>Solde prévisionnel</span><b class="${ending>=0?'positive':'negative'}">${euro(ending)}</b></div>
    </div>
    <section class="forecast-controls">
      <div class="forecast-filter-row forecast-types">${typeFilters.map(([id,label])=>`<button class="filter-chip ${forecastTypeFilter===id?'active':''}" data-forecast-type="${id}">${label}</button>`).join('')}</div>
      <div class="forecast-filter-row forecast-ranges">${rangeFilters.map(([id,label])=>`<button class="filter-chip ${forecastRange===id?'active':''}" data-forecast-range="${id}">${label}</button>`).join('')}</div>
    </section>
    <div class="section-title"><h2>Chronologie</h2><span>${selected.length} opération${selected.length>1?'s':''}</span></div>
    <div class="forecast-timeline forecast-groups">
      ${groups.length?groups.map(g=>`<section class="forecast-group">
        <header><div><span>${g.label}</span><small>${g.rows.length} opération${g.rows.length>1?'s':''}</small></div><b class="${g.total>=0?'positive':'negative'}">${g.total>=0?'+':'−'}${euro(Math.abs(g.total))}</b></header>
        <div class="forecast-group-list">${g.rows.map(e=>`<div class="forecast-row ${e.kind}" ${e.source==='movement'?`data-edit="${esc(e.id)}"`:''}>
          <div class="forecast-date"><b>${String(e.day).padStart(2,'0')}</b><small>${state.months[month].month.slice(0,3)}</small></div>
          <div class="forecast-main"><strong>${esc(e.title)}${e.recurring?'<span class="recurring-badge" title="Mouvement récurrent">↻</span>':''}</strong><small>${e.estimated?'Prévision automatique':e.shifted?'Report au jour ouvré':e.source==='recurring'?'Échéance récurrente':'Mouvement à pointer'}</small></div>
          <div class="forecast-values"><b class="${e.amount>=0?'positive':'negative'}">${e.amount>=0?'+':'−'}${euro(Math.abs(e.amount))}</b><small>Solde réel prévu : ${euro(e.balanceAfter)}</small></div>
        </div>`).join('')}</div>
        <footer>Solde réel prévu après la dernière opération affichée <b>${euro(g.rows[g.rows.length-1].balanceAfter)}</b></footer>
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
      <div><span>Version</span><strong>3.5.0 Test</strong></div><div><span>Taille des données</span><strong>${snap.size}</strong></div>
      <div><span>Mouvements</span><strong>${snap.movements}</strong></div><div><span>Catégories</span><strong>${snap.categories}</strong></div>
      <div><span>Sous-catégories</span><strong>${snap.subcategories}</strong></div><div><span>Lignes de budget</span><strong>${snap.budgets}</strong></div>
      <div><span>Sauvegardes locales</span><strong>${snap.backups}</strong></div><div><span>Dernier enregistrement</span><strong class="small-value">${esc(snap.lastSaved)}</strong></div>
    </section>
    <section class="diagnostic-card"><div class="diagnostic-card-head"><div><span>Vérifications automatiques</span><h3>Intégrité des données</h3></div><button class="btn" data-run-diagnostic>Analyser KerBudget</button></div><div class="diagnostic-results">${checks}</div></section>
    <section class="diagnostic-card"><div class="diagnostic-card-head"><div><span>Rapport</span><h3>Conserver ou partager le résultat</h3></div></div><p>Le rapport contient uniquement des informations techniques et les anomalies détectées. Il ne modifie aucune donnée.</p><button class="btn secondary" data-download-diagnostic ${result?'':'disabled'}>Télécharger le rapport</button></section>
  `);
}

function forecastSettingsPage(){const c=state.forecastSettings;return layout(`<div class="section-title"><div><h2>Prévisions</h2><small>Choisis comment KerBudget estime les dates dans À venir.</small></div></div>
  <section class="settings-card"><h3>Jours ouvrés</h3>
    <label class="setting-line"><span><b>Factures</b><small>Reporter au prochain jour ouvré.</small></span><input type="checkbox" data-forecast-setting="shiftBills" ${c.shiftBills?'checked':''}></label>
    <label class="setting-line"><span><b>Revenus</b><small>Reporter au prochain jour ouvré.</small></span><input type="checkbox" data-forecast-setting="shiftIncome" ${c.shiftIncome?'checked':''}></label>
    <label class="setting-line"><span><b>Virements d’épargne</b><small>Reporter au prochain jour ouvré.</small></span><input type="checkbox" data-forecast-setting="shiftSavings" ${c.shiftSavings?'checked':''}></label>
    <label class="setting-line"><span><b>Jours fériés français</b><small>Les considérer comme non ouvrés.</small></span><input type="checkbox" data-forecast-setting="useFrenchHolidays" ${c.useFrenchHolidays?'checked':''}></label>
  </section>
  <section class="settings-card"><h3>Dépenses non pointées</h3><p>Lorsqu’une dépense est encore non pointée et que sa date est passée, la prévoir dans :</p>
    <div class="delay-options">${[[0,'Ne pas prévoir'],[1,'1 jour ouvré'],[2,'2 jours ouvrés'],[3,'3 jours ouvrés']].map(([v,l])=>`<label class="delay-choice"><input type="radio" name="expenseDelay" value="${v}" ${Number(c.expenseDelay)===v?'checked':''}><span>${l}</span></label>`).join('')}</div>
  </section>
  <p class="settings-note">Les dates saisies restent inchangées dans les mouvements. Ces réglages modifient uniquement la prévision affichée.</p>`)}

function more(){
  const backups=readBackups(), last=backups[0]?new Date(backups[0].date).toLocaleString('fr-FR'):'Aucune';
  let openSections={};try{openSections=JSON.parse(localStorage.getItem('kerbudget.more.sections')||'{}')}catch(e){}
  const section=(id,icon,title,items)=>`<details class="more-section" data-more-section="${id}" ${openSections[id]!==false?'open':''}><summary><span class="more-section-title"><b>${icon}</b>${title}</span><span class="more-section-count">${items.length}</span></summary><div class="more-section-body">${items.join('')}</div></details>`;
  const item=(go,icon,title,desc,keywords='')=>`<button type="button" class="more-item" data-go="${go}" data-more-item data-search="${esc((title+' '+desc+' '+keywords).toLowerCase())}"><span class="more-item-icon">${icon}</span><span class="more-item-copy"><b>${title}</b><small>${desc}</small></span><span class="more-item-arrow">›</span></button>`;
  const backupItem=`<div class="more-item more-item-static" data-more-item data-search="sauvegarde export import restauration sécurité données"><span class="more-item-icon">💾</span><span class="more-item-copy"><b>Sauvegardes</b><small>${backups.length} locale${backups.length>1?'s':''} · dernière : ${last}</small><span class="more-inline-actions"><button class="mini-btn" data-backup-download>Exporter</button><button class="mini-btn" data-backup-import>Importer</button><button class="mini-btn" data-backup-restore>Restaurer</button></span><input type="file" id="backupFileInput" accept="application/json,.json" hidden></span></div>`;
  const maintenance=`<div class="more-item more-item-static" data-more-item data-search="maintenance export import données brutes réinitialiser excel"><span class="more-item-icon">🧰</span><span class="more-item-copy"><b>Maintenance</b><small>Outils techniques pour les données locales.</small><span class="more-inline-actions"><button class="mini-btn" data-export>Exporter les données</button><button class="mini-btn" data-import>Importer</button><button class="mini-btn danger" data-reset>Réinitialiser</button></span><input id="fileInput" type="file" accept="application/json" hidden></span></div>`;
  return layout(`<div class="section-title more-title"><div><h2>Plus</h2><small>Réglages, analyses et outils de KerBudget.</small></div></div>
    <div class="more-search"><span>⌕</span><input id="moreSearch" type="search" placeholder="Rechercher dans Plus…" autocomplete="off"></div>
    <div id="moreSections" class="more-sections">
      ${section('analysis','📊','Analyses',[
        item('report','▤','Bilan mensuel','Résultat du mois et dépenses par catégorie.','analyse résultat'),
        item('annual','▥','Synthèse annuelle','Vue complète des douze mois.','année graphique')
      ])}
      ${section('finance','💰','Finances',[
        item('budget','▦','Budget','Comparer les montants prévus et réels.','prévu dépensé'),
        item('savings','◆','Épargne','Solde, objectif et détail des virements.','livret a versements retraits'),
        item('solar','☀','Prêt photovoltaïque','Consulter l’échéancier du prêt.','crédit échéancier')
      ])}
      ${section('management','🗂️','Gestion',[
        item('categories','🏷️','Catégories et sous-catégories','Ajouter, renommer ou supprimer.','classement'),
        item('recurring','🔁','Factures récurrentes','Prélèvements et factures automatiques.','mensuel trimestriel annuel'),
        backupItem
      ])}
      ${section('tools','🛠️','Outils',[
        item('diagnostic','✓','Diagnostic','Contrôler l’intégrité des données.','rapport qualité'),
        maintenance
      ])}
      ${section('application','⚙️','Application',[
        item('forecast-settings','◷','Prévisions','Jours ouvrés et dépenses non pointées.','factures revenus épargne jours fériés'),
        `<div class="more-item more-item-static" data-more-item data-search="application version kerbudget mise à jour"><span class="more-item-icon">ℹ</span><span class="more-item-copy"><b>KerBudget 3.5.7 Test</b><small>Version installée sur cet appareil.</small></span></div>`
      ])}
    </div>
    <div id="moreEmpty" class="empty more-empty" hidden>Aucun réglage ne correspond à cette recherche.</div>`)
}
function render(){let html=view==='home'?home():view==='transactions'?transactions():view==='forecast'?cashForecast():view==='annual'?annual():view==='savings'?savings():view==='budget'?budget():view==='solar'?solar():view==='recurring'?recurring():view==='savings-recurring'?savingsRecurring():view==='report'?monthlyReport():view==='categories'?categoriesPage():view==='diagnostic'?diagnostic():view==='forecast-settings'?forecastSettingsPage():more();document.querySelector('#app').innerHTML=html;document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));bind()}
function bind(){document.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{month=+b.dataset.month;ensureRecurringForMonth(month);render()});document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{view=b.dataset.go;render()});document.querySelectorAll('[data-open-savings]').forEach(b=>b.onclick=()=>{view='savings';render()});document.querySelectorAll('[data-monthgo]').forEach(b=>b.onclick=()=>{month=+b.dataset.monthgo;ensureRecurringForMonth(month);view='transactions';render()});document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>editTx());document.querySelectorAll('[data-add-type]').forEach(b=>b.onclick=()=>editTx(null,b.dataset.addType));document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit));document.querySelectorAll('[data-toggle-point]').forEach(b=>b.onclick=e=>{e.stopPropagation();const t=findTransaction(b.dataset.togglePoint);if(t){t.pointed=!t.pointed;save('pointage');render()}});document.querySelectorAll('[data-tx-status]').forEach(b=>b.onclick=()=>{txStatusFilter=b.dataset.txStatus;render()});document.querySelectorAll('[data-tx-type]').forEach(b=>b.onclick=()=>{txTypeFilter=b.dataset.txType;render()});document.querySelectorAll('[data-forecast-type]').forEach(b=>b.onclick=()=>{forecastTypeFilter=b.dataset.forecastType;render()});document.querySelectorAll('[data-forecast-range]').forEach(b=>b.onclick=()=>{forecastRange=b.dataset.forecastRange;render()});document.querySelectorAll('[data-budget]').forEach(i=>i.onchange=()=>{state.months[month].budgetLines[+i.dataset.budget].planned=+i.value||0;save()});let q=document.querySelector('#search');if(q)q.oninput=()=>{txSearch=q.value;document.querySelector('#txarea').innerHTML=pointageListHtml();document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit));document.querySelectorAll('[data-toggle-point]').forEach(b=>b.onclick=e=>{e.stopPropagation();const t=findTransaction(b.dataset.togglePoint);if(t){t.pointed=!t.pointed;save('pointage');render()}})};let ex=document.querySelector('[data-export]');if(ex)ex.onclick=exportData;let im=document.querySelector('[data-import]');if(im)im.onclick=()=>document.querySelector('#fileInput').click();let fi=document.querySelector('#fileInput');if(fi)fi.onchange=importData;let bd=document.querySelector('[data-backup-download]');if(bd)bd.onclick=downloadBackup;let bi=document.querySelector('[data-backup-import]');if(bi)bi.onclick=()=>document.querySelector('#backupFileInput').click();let bf=document.querySelector('#backupFileInput');if(bf)bf.onchange=e=>{if(e.target.files[0])importBackupFile(e.target.files[0])};let br=document.querySelector('[data-backup-restore]');if(br)br.onclick=recoverLatestBackup;document.querySelectorAll('[data-recurring-edit]').forEach(x=>x.onclick=()=>editRecurring(x.dataset.recurringEdit,x.dataset.recurringKind||null));
let ra=document.querySelector('[data-recurring-add]');if(ra)ra.onclick=()=>editRecurring(null,ra.dataset.recurringKind||'bill');
let rg=document.querySelector('[data-recurring-generate]');if(rg)rg.onclick=()=>{ensureRecurringForMonth(month,true);render()};
document.querySelectorAll('[data-category-add]').forEach(b=>b.onclick=addCategory);document.querySelectorAll('[data-category-rename]').forEach(b=>b.onclick=()=>renameCategory(b.dataset.categoryRename));document.querySelectorAll('[data-category-delete]').forEach(b=>b.onclick=()=>deleteCategory(b.dataset.categoryDelete));document.querySelectorAll('[data-sub-add]').forEach(b=>b.onclick=()=>addSubcategory(b.dataset.subAdd));document.querySelectorAll('[data-sub-rename]').forEach(b=>b.onclick=()=>{const [c,...rest]=b.dataset.subRename.split('|');renameSubcategory(c,rest.join('|'))});document.querySelectorAll('[data-sub-delete]').forEach(b=>b.onclick=()=>{const [c,...rest]=b.dataset.subDelete.split('|');deleteSubcategory(c,rest.join('|'))});
let rd=document.querySelector('[data-run-diagnostic]');if(rd)rd.onclick=()=>{analyzeKerBudget();render()};let dd=document.querySelector('[data-download-diagnostic]');if(dd)dd.onclick=downloadDiagnosticReport;
let ms=document.querySelector('#moreSearch');if(ms)ms.oninput=()=>{const q=ms.value.trim().toLowerCase(),items=[...document.querySelectorAll('[data-more-item]')];let visible=0;items.forEach(x=>{const show=!q||(x.dataset.search||'').includes(q);x.hidden=!show;if(show)visible++});document.querySelectorAll('.more-section').forEach(sec=>{const count=[...sec.querySelectorAll('[data-more-item]')].filter(x=>!x.hidden).length;sec.hidden=count===0;if(q&&count)sec.open=true});const empty=document.querySelector('#moreEmpty');if(empty)empty.hidden=visible!==0};document.querySelectorAll('[data-more-section]').forEach(sec=>sec.ontoggle=()=>{let v={};try{v=JSON.parse(localStorage.getItem('kerbudget.more.sections')||'{}')}catch(e){}v[sec.dataset.moreSection]=sec.open;localStorage.setItem('kerbudget.more.sections',JSON.stringify(v))});
document.querySelectorAll('[data-forecast-setting]').forEach(x=>x.onchange=()=>{state.forecastSettings[x.dataset.forecastSetting]=x.checked;save('réglages prévisions');render()});document.querySelectorAll('input[name="expenseDelay"]').forEach(x=>x.onchange=()=>{state.forecastSettings.expenseDelay=+x.value;save('réglages prévisions');render()});
let rs=document.querySelector('[data-reset]');if(rs)rs.onclick=()=>{if(confirm('Attention : une sauvegarde sera créée avant la réinitialisation. Continuer ?')){createBackup('avant réinitialisation');state=normalizeState(D);localStorage.setItem(KEY,JSON.stringify(state));render()}}}
function sameId(a,b){return String(a??'')===String(b??'')}
function findTransaction(id){return state.transactions.find(t=>sameId(t.id,id))||null}
function removeTransaction(id){const before=state.transactions.length;state.transactions=state.transactions.filter(t=>!sameId(t.id,id));return state.transactions.length<before}
function editTx(id,presetType=null){
  let old=id?findTransaction(id):null;
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
    const added=!old;
    if(added)state.transactions.push(t);
    const ok=save(old?'modification mouvement':'ajout mouvement');
    if(!ok){if(added)state.transactions=state.transactions.filter(x=>!sameId(x.id,t.id));return}
    closeModal();render();showToast(old?'Mouvement modifié':'Mouvement ajouté');
  };
  let dup=document.querySelector('#duplicate');if(dup)dup.onclick=()=>{const copy=cloneData(t);copy.id='u'+Date.now();copy.day=new Date().getDate();copy.pointed=false;state.transactions.push(copy);if(!save('duplication mouvement')){state.transactions=state.transactions.filter(x=>!sameId(x.id,copy.id));return}closeModal();render();showToast('Mouvement dupliqué')};
  let del=document.querySelector('#del');if(del){
    let deleteArmed=false;
    del.onclick=()=>{
      if(!deleteArmed){
        deleteArmed=true;
        del.textContent='Confirmer la suppression';
        del.classList.add('delete-armed');
        showToast('Appuie encore une fois pour supprimer');
        setTimeout(()=>{
          deleteArmed=false;
          if(document.body.contains(del)){
            del.textContent='Supprimer';
            del.classList.remove('delete-armed');
          }
        },5000);
        return;
      }
      del.disabled=true;
      del.textContent='Suppression…';
      const before=state.transactions.slice();
      try{
        let index=state.transactions.indexOf(old);
        if(index<0)index=state.transactions.findIndex(x=>sameId(x.id,t.id));
        if(index<0)throw new Error('Mouvement introuvable');
        const removed=state.transactions[index];
        state.transactions.splice(index,1);
        if(removed&&removed.recurringKey){
          state.recurringSkips=Array.from(new Set([...(state.recurringSkips||[]),removed.recurringKey]));
        }
        if(!save('suppression mouvement'))throw new Error('Enregistrement impossible');
        const stored=JSON.parse(localStorage.getItem(KEY)||'{}');
        if((stored.transactions||[]).some(x=>sameId(x.id,removed?.id)))throw new Error('La suppression n’a pas été enregistrée');
        closeModal();
        render();
        showToast('Mouvement supprimé');
      }catch(error){
        state.transactions=before;
        console.error('Suppression impossible',error);
        del.disabled=false;
        deleteArmed=false;
        del.textContent='Supprimer';
        del.classList.remove('delete-armed');
        alert('La suppression a échoué : '+(error.message||'erreur inconnue'));
      }
    };
  }

}
function showToast(message){let old=document.querySelector('.app-toast');if(old)old.remove();let el=document.createElement('div');el.className='app-toast';el.textContent=message+' ✓';document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),250)},1800)}
function closeModal(){document.querySelector('#modal').hidden=true;document.querySelector('#modal').innerHTML=''}
function exportData(){let b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='budget-2026-sauvegarde.json';a.click();URL.revokeObjectURL(a.href)}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();alert('Sauvegarde restaurée.');render()}catch{alert('Fichier de sauvegarde invalide.')}};r.readAsText(f)}
document.querySelectorAll('.bottom button').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;let b=document.querySelector('#installBtn');b.hidden=false;b.onclick=()=>deferredPrompt.prompt()});if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js?v=355').then(r=>r.update()).catch(()=>{});}ensureRecurringForMonth(month);render();
