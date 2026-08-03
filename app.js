
const D=window.INITIAL_DATA, KEY='budget2026.test.v2', BACKUP_KEY='budget2026.test.backups', APP_VERSION='2.9.0-test', MAX_BACKUPS=12;
let state=load(), view='home', month=Math.max(0,Math.min(11,new Date().getFullYear()===2026?new Date().getMonth():0)), deferredPrompt=null;
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
function savingsBalance(){
  return savingsOpening()+savingsTransfers(null,true).reduce((s,t)=>s+(Number(t.amount)||0),0);
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
function budgetAlerts(i){const out=[],lines=state.months[i].budgetLines||[];for(const l of lines){if(l.type!=='expense'||!l.planned)continue;const spent=mtx(i).filter(t=>isExpenseType(t)&&t.category===l.category).reduce((s,t)=>s+(Number(t.amount)||0),0),r=spent/l.planned;if(r>=1)out.push({tone:'danger',text:`${l.label||l.category} dépasse le budget de ${euro(spent-l.planned)}`});else if(r>=.85)out.push({tone:'warning',text:`${l.label||l.category} est à ${(r*100).toFixed(0)} % du budget`})}return out.slice(0,3)}
function home(){const current=balance(month,true),projected=balance(month,false),savings=savingsBalance(),pending=mtx(month).filter(t=>!t.pointed),recurringPending=recurringToGenerate(month),incomplete=incompleteMovements(month),upcoming=importantUpcoming(month),alerts=budgetAlerts(month),t=totals(month),p=planned(month),available=Math.max(0,p.expense-t.expense),saved=monthSavings(month),actions=[];if(pending.length)actions.push({label:`Pointer ${pending.length} opération${pending.length>1?'s':''}`,go:'transactions'});if(recurringPending.length)actions.push({label:`Générer ${recurringPending.length} facture${recurringPending.length>1?'s':''}`,go:'recurring'});if(incomplete.length)actions.push({label:`Compléter ${incomplete.length} mouvement${incomplete.length>1?'s':''}`,go:'transactions'});return layout(`${monthbar()}<section class="cockpit-balance"><div class="cockpit-main"><span>Compte courant</span><strong>${euro(current)}</strong><small>Fin de mois prévue : ${euro(projected)}</small></div><div class="cockpit-side"><div><span>Épargne</span><b>${euro(savings)}</b></div><div><span>Disponible</span><b>${euro(available)}</b></div></div></section>${actions.length?`<section class="cockpit-block"><div class="cockpit-title"><h2>À faire</h2><span>${actions.length}</span></div><div class="action-list">${actions.map(a=>`<button data-go="${a.go}"><span>→</span>${esc(a.label)}</button>`).join('')}</div></section>`:`<section class="cockpit-ok"><span>✓</span><div><strong>Tout est à jour</strong><small>Aucune action nécessaire.</small></div></section>`}${upcoming.length?`<section class="cockpit-block"><div class="cockpit-title"><h2>À venir</h2><button class="text-link" data-go="transactions">Tout voir</button></div><div class="upcoming-list">${upcoming.map(x=>`<div class="upcoming-item" ${x.source==='movement'?`data-edit="${esc(x.id)}"`:''}><div class="upcoming-date">${String(x.day).padStart(2,'0')}</div><div><strong>${esc(x.title)}</strong><small>Solde après : ${euro(x.balanceAfter)}</small></div><b class="${x.amount>=0?'positive':'negative'}">${x.amount>=0?'+':'−'}${euro(Math.abs(x.amount))}</b></div>`).join('')}</div></section>`:''}<section class="cockpit-block"><div class="cockpit-title"><h2>Situation du mois</h2><button class="text-link" data-go="report">Bilan</button></div><div class="situation-grid"><div><span>Revenus</span><b class="positive">${euro(t.income)}</b></div><div><span>Dépenses</span><b class="negative">${euro(t.expense)}</b></div><div><span>Épargne</span><b>${euro(saved)}</b></div><div><span>Reste budget</span><b>${euro(available)}</b></div></div></section>${alerts.length?`<section class="cockpit-block"><div class="cockpit-title"><h2>Alertes</h2></div><div class="alert-list">${alerts.map(a=>`<div class="alert-item ${a.tone}">${esc(a.text)}</div>`).join('')}</div></section>`:''}<button class="fab" data-add>+</button>`)}
function txList(list){return `<div class="list">${list.length?list.map(t=>{normalizeMovement(t);const positive=isIncomeType(t);const flow=t.fromAccount&&t.toAccount?` · ${accountLabel(t.fromAccount)} → ${accountLabel(t.toAccount)}`:'';return `<div class="row" data-edit="${esc(t.id)}"><div><div class="title">${t.pointed?'✓ ':''}${esc(t.description||t.subcategory||'Mouvement')}</div><div class="sub">${t.day?String(t.day).padStart(2,'0')+'/':''}${String(t.month+1).padStart(2,'0')}/2026 · ${esc(typeLabel(t.type))}${flow}${t.subcategory?' · '+esc(t.subcategory):''}</div></div><div class="amount ${positive?'positive':'negative'}">${positive?'+':'−'}${euro(Math.abs(t.amount))}</div></div>`}).join(''):'<div class="empty">Aucun mouvement.</div>'}</div>`}
function txGroups(list){
  const billCats=new Set(['Habitation','Télécommunications','Assurances','Banque','Impots']);
  const isWorks=t=>{
    const s=((t.category||'')+' '+(t.subcategory||'')+' '+(t.description||'')).toLowerCase();
    return s.includes('aménagement')||s.includes('amenagement')||s.includes('travaux');
  };
  const revenus=list.filter(t=>isIncomeType(t));
  const factures=list.filter(t=>inferMovementType(t)==='bill');
  const autres=list.filter(t=>!isIncomeType(t)&&inferMovementType(t)!=='bill');
  const total=a=>a.reduce((s,t)=>s+(Number(t.amount)||0),0);
  const statusBlock=(items,label)=>{
    const pointed=items.filter(t=>t.pointed), pending=items.filter(t=>!t.pointed);
    return `
      ${pending.length?`<div class="status-group pending-group">
        <div class="status-head"><span>À pointer</span><strong>${pending.length}</strong></div>
        ${txList(pending)}
      </div>`:''}
      ${pointed.length?`<div class="status-group pointed-group">
        <div class="status-head"><span>Pointés</span><strong>${pointed.length}</strong></div>
        ${txList(pointed)}
      </div>`:''}`;
  };
  return `
    <section class="txgroup income-group">
      <div class="txgroup-head"><div><span class="txgroup-icon">↗</span><h3>Revenus</h3><small>${revenus.length} mouvement${revenus.length>1?'s':''}</small></div><strong class="positive">+${euro(total(revenus))}</strong></div>
      ${statusBlock(revenus,'Revenus')}
    </section>
    <section class="txgroup bills-group">
      <div class="txgroup-head"><div><span class="txgroup-icon">▣</span><h3>Factures</h3><small>${factures.length} mouvement${factures.length>1?'s':''}</small></div><strong class="negative">−${euro(total(factures))}</strong></div>
      ${statusBlock(factures,'Factures')}
    </section>
    <section class="txgroup other-group">
      <div class="txgroup-head"><div><span class="txgroup-icon">•••</span><h3>Autres dépenses</h3><small>${autres.length} mouvement${autres.length>1?'s':''}</small></div><strong class="negative">−${euro(total(autres))}</strong></div>
      ${statusBlock(autres,'Autres dépenses')}
    </section>`;
}
function transactions(){
  const all=mtx(month).slice().sort((a,b)=>(a.day||0)-(b.day||0));
  const forecast=forecastData(month);
  const pointed=all.filter(t=>t.pointed);
  const pending=all.filter(t=>!t.pointed);
  const futureRecurring=forecast.rows.filter(e=>e.source==='recurring');

  return layout(`${monthbar()}
    <div class="section-title">
      <h2>Mouvements • ${state.months[month].month}</h2>
      <button class="btn" data-add>+ Ajouter</button>
    </div>

    <section class="movement-overview">
      <div>
        <span>Solde pointé</span>
        <b>${euro(forecast.opening)}</b>
      </div>
      <div>
        <span>Fin de mois prévue</span>
        <b class="${forecast.ending>=0?'positive':'negative'}">${euro(forecast.ending)}</b>
      </div>
      <div>
        <span>Minimum prévu</span>
        <b class="${forecast.min>=0?'positive':'negative'}">${euro(forecast.min)}</b>
      </div>
      <div>
        <span>À pointer</span>
        <b>${pending.length}</b>
      </div>
    </section>

    <input class="search" id="search" placeholder="Rechercher dans les mouvements…">

    <div id="txarea" style="margin-top:14px">
      ${pending.length?`
        <section class="unified-section pending">
          <div class="unified-head">
            <div><h3>À pointer</h3><small>${pending.length} opération${pending.length>1?'s':''}</small></div>
            <strong>${euro(pending.reduce((s,t)=>s+(Number(t.amount)||0),0))}</strong>
          </div>
          ${txList(pending)}
        </section>`:''}

      ${futureRecurring.length?`
        <section class="unified-section upcoming">
          <div class="unified-head">
            <div><h3>À venir</h3><small>Échéances récurrentes non générées</small></div>
            <strong>${euro(futureRecurring.reduce((s,e)=>s+Math.abs(e.amount),0))}</strong>
          </div>
          <div class="list">
            ${futureRecurring.map(e=>`
              <div class="row future-row">
                <div>
                  <div class="title">🟡 ${esc(e.title)}</div>
                  <div class="sub">${String(e.day).padStart(2,'0')}/${String(month+1).padStart(2,'0')}/2026 · Solde prévu ${euro(e.balanceAfter)}</div>
                </div>
                <div class="amount negative">−${euro(Math.abs(e.amount))}</div>
              </div>`).join('')}
          </div>
        </section>`:''}

      ${pointed.length?`
        <section class="unified-section pointed">
          <div class="unified-head">
            <div><h3>Pointés</h3><small>${pointed.length} opération${pointed.length>1?'s':''}</small></div>
          </div>
          ${txList(pointed)}
        </section>`:''}

      ${!pending.length&&!futureRecurring.length&&!pointed.length?'<div class="empty">Aucun mouvement pour ce mois.</div>':''}
    </div>
  `);
}function budget(){let ls=state.months[month].budgetLines, groups={};for(const l of ls)(groups[l.type==='income'?'Revenus':l.category]??=[]).push(l);return layout(`${monthbar()}<div class="section-title"><h2>Budget prévu • ${state.months[month].month}</h2><button class="btn secondary" data-go="home">Terminé</button></div><div class="list">${Object.entries(groups).map(([g,ls])=>`<div class="cathead">${esc(g)}</div>${ls.map((l,idx)=>{let gi=state.months[month].budgetLines.indexOf(l);let actual=mtx(month).filter(t=>l.type==='income'?t.category.trim()==='Revenus':t.category.trim()===g.trim()).reduce((a,b)=>a+b.amount,0);return `<div class="budgetrow"><div><b>${esc(l.label)}</b><small>${l.type==='income'?'Revenu':'Dépense'}</small></div><input type="number" step="0.01" value="${l.planned}" data-budget="${gi}"><div class="actual">${euro(actual)}</div></div>`}).join('')}`).join('')}</div><p class="muted">Colonne centrale : montant anticipé modifiable. À droite : réel actuel de la catégorie.</p>`)}
function annual(){let arr=state.months.map((m,i)=>{let t=totals(i),p=planned(i);return{m:m.month.slice(0,3),inc:t.income,exp:t.expense,planned:p.expense,bal:t.income-t.expense}});let inc=arr.reduce((a,b)=>a+b.inc,0),exp=arr.reduce((a,b)=>a+b.exp,0),bud=arr.reduce((a,b)=>a+b.planned,0),mx=Math.max(...arr.map(x=>Math.abs(x.bal)),1);return layout(`<div class="section-title"><h2>Synthèse annuelle 2026</h2></div><div class="kpi3"><div class="card"><div class="cap">REVENUS</div><div class="val positive">${euro(inc)}</div></div><div class="card"><div class="cap">DÉPENSES</div><div class="val negative">${euro(exp)}</div></div><div class="card"><div class="cap">SOLDE</div><div class="val ${inc-exp>=0?'positive':'negative'}">${euro(inc-exp)}</div></div></div><div class="card" style="margin-top:12px"><div class="cap">SOLDE MENSUEL</div><div class="chart">${arr.map(x=>`<div class="barcol"><div class="bar ${x.bal<0?'neg':''}" style="height:${Math.max(3,Math.abs(x.bal)/mx*130)}px"></div><span>${x.m}</span></div>`).join('')}</div></div><div class="section-title"><h2>Mois par mois</h2></div><div class="list">${arr.map((x,i)=>`<div class="row" data-monthgo="${i}"><div><div class="title">${state.months[i].month}</div><div class="sub">Budget dépenses ${euro(x.planned)} · Réel ${euro(x.exp)}</div></div><div class="amount ${x.bal>=0?'positive':'negative'}">${euro(x.bal)}</div></div>`).join('')}</div>`)}
function savings(){
  const opening=savingsOpening();
  const pointed=savingsTransfers(null,true);
  const monthTransfers=savingsTransfers(month,true).slice().sort((a,b)=>(b.day||0)-(a.day||0));
  const annual=pointed.reduce((s,t)=>s+(Number(t.amount)||0),0);
  const current=opening+annual;
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
        <div class="hero-mini">Ce mois-ci<b>${euro(monthTransfers.reduce((s,t)=>s+(Number(t.amount)||0),0))}</b></div>
        <div class="hero-mini">Objectif annuel<b>${euro(goal)}</b></div>
      </div>
    </section>
    <div class="section-title"><h2>Progression de l’épargne</h2></div>
    <div class="card">
      <div class="progress"><i style="width:${progress}%"></i></div>
      <div class="sub" style="margin-top:8px">${progress.toFixed(0)} % de l’objectif</div>
    </div>
    <div class="section-title"><h2>Virements pointés • ${state.months[month].month}</h2></div>
    ${monthTransfers.length?txList(monthTransfers):'<div class="empty">Aucun virement vers le Livret A pointé ce mois-ci.</div>'}
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
function cashForecast(){
  const f=forecastData(month);
  const alert=f.min<0
    ?{tone:'danger',icon:'🔴',text:`Découvert prévisionnel : ${euro(f.min)}`}
    :f.min<200
      ?{tone:'warning',icon:'🟠',text:`Solde minimum faible : ${euro(f.min)}`}
      :{tone:'success',icon:'🟢',text:'Aucune période de découvert prévue.'};
  return layout(`${monthbar()}
    <div class="section-title"><h2>Prévision de trésorerie • ${state.months[month].month}</h2></div>
    <section class="forecast-alert ${alert.tone}"><span>${alert.icon}</span><strong>${alert.text}</strong></section>

    <div class="forecast-cards">
      <div><span>Solde actuel pointé</span><b>${euro(f.opening)}</b></div>
      <div><span>Solde minimum prévu</span><b class="${f.min>=0?'positive':'negative'}">${euro(f.min)}</b></div>
      <div><span>Fin de mois prévue</span><b class="${f.ending>=0?'positive':'negative'}">${euro(f.ending)}</b></div>
      <div><span>Opérations à venir</span><b>${f.rows.length}</b></div>
    </div>

    <div class="forecast-highlights">
      <div><span>Prochaine rentrée</span><b>${f.nextIncome?`${esc(f.nextIncome.title)} · ${euro(f.nextIncome.amount)}`:'Aucune'}</b></div>
      <div><span>Plus grosse sortie</span><b>${f.largestExpense?`${esc(f.largestExpense.title)} · ${euro(Math.abs(f.largestExpense.amount))}`:'Aucune'}</b></div>
    </div>

    <div class="section-title"><h2>Évolution prévue</h2></div>
    <div class="forecast-timeline">
      <div class="forecast-start"><span>Aujourd’hui</span><b>${euro(f.opening)}</b></div>
      ${f.rows.length?f.rows.map(e=>`
        <div class="forecast-row ${e.kind}" ${e.source==='movement'?`data-edit="${esc(e.id)}"`:''}>
          <div class="forecast-date">${String(e.day).padStart(2,'0')}</div>
          <div class="forecast-main">
            <strong>${esc(e.title)}</strong>
            <small>${e.source==='recurring'?'Échéance récurrente non générée':'Mouvement non pointé'}</small>
          </div>
          <div class="forecast-values">
            <b class="${e.amount>=0?'positive':'negative'}">${e.amount>=0?'+':'−'}${euro(Math.abs(e.amount))}</b>
            <small>Solde : ${euro(e.balanceAfter)}</small>
          </div>
        </div>`).join(''):'<div class="empty">Aucune opération à venir pour ce mois.</div>'}
    </div>
  `);
}
function more(){const b=readBackups(),last=b[0]?new Date(b[0].date).toLocaleString('fr-FR'):'Aucune';return layout(`<div class="section-title"><h2>Outils</h2></div><div class="settings-grid"><section class="settings-card"><h3>🔒 Sécurité des données</h3><p>Les mises à jour conservent les données enregistrées sur cet appareil.</p><div class="security-status"><div><span>Version</span><strong>KerBudget 2.5 Test</strong></div><div><span>Sauvegardes locales</span><strong>${b.length}</strong></div><div><span>Dernière sauvegarde</span><strong>${last}</strong></div></div><div class="action-stack"><button class="btn" data-backup-download>Exporter une sauvegarde</button><button class="btn secondary" data-backup-import>Importer une sauvegarde</button><button class="btn secondary" data-backup-restore>Restaurer la dernière sauvegarde locale</button><input type="file" id="backupFileInput" accept="application/json,.json" hidden></div></section><section class="settings-card"><h3>📊 Bilan mensuel</h3><p>Comparer revenus, dépenses, épargne et opérations en attente.</p><button class="btn" data-go="report">Ouvrir le bilan</button></section><section class="settings-card"><h3>🔁 Factures récurrentes</h3><p>Créer automatiquement les échéances mensuelles, trimestrielles ou annuelles.</p><button class="btn" data-go="recurring">Gérer les factures</button></section><section class="settings-card"><h3>☀ Prêt photovoltaïque</h3><button class="btn secondary" data-go="solar">Ouvrir l'échéancier</button></section><section class="settings-card"><h3>Maintenance</h3><button class="btn secondary" data-export>Exporter les données brutes</button><button class="btn secondary" data-import>Importer les données brutes</button><input id="fileInput" type="file" accept="application/json" hidden><button class="btn danger" data-reset>Réinitialiser depuis Excel</button></section></div>`)}
function render(){let html=view==='home'?home():view==='transactions'?transactions():view==='annual'?annual():view==='savings'?savings():view==='budget'?budget():view==='solar'?solar():view==='recurring'?recurring():view==='report'?monthlyReport():more();document.querySelector('#app').innerHTML=html;document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));bind()}
function bind(){document.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{month=+b.dataset.month;ensureRecurringForMonth(month);render()});document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{view=b.dataset.go;render()});document.querySelectorAll('[data-monthgo]').forEach(b=>b.onclick=()=>{month=+b.dataset.monthgo;ensureRecurringForMonth(month);view='home';render()});document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>editTx());document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit));document.querySelectorAll('[data-budget]').forEach(i=>i.onchange=()=>{state.months[month].budgetLines[+i.dataset.budget].planned=+i.value||0;save()});let q=document.querySelector('#search');if(q)q.oninput=()=>{let s=q.value.toLowerCase(),l=mtx(month).filter(t=>(t.description+' '+t.category+' '+t.subcategory).toLowerCase().includes(s));document.querySelector('#txarea').innerHTML=txList(l);document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit))};let ex=document.querySelector('[data-export]');if(ex)ex.onclick=exportData;let im=document.querySelector('[data-import]');if(im)im.onclick=()=>document.querySelector('#fileInput').click();let fi=document.querySelector('#fileInput');if(fi)fi.onchange=importData;let bd=document.querySelector('[data-backup-download]');if(bd)bd.onclick=downloadBackup;let bi=document.querySelector('[data-backup-import]');if(bi)bi.onclick=()=>document.querySelector('#backupFileInput').click();let bf=document.querySelector('#backupFileInput');if(bf)bf.onchange=e=>{if(e.target.files[0])importBackupFile(e.target.files[0])};let br=document.querySelector('[data-backup-restore]');if(br)br.onclick=recoverLatestBackup;document.querySelectorAll('[data-recurring-edit]').forEach(x=>x.onclick=()=>editRecurring(x.dataset.recurringEdit));
let ra=document.querySelector('[data-recurring-add]');if(ra)ra.onclick=()=>editRecurring();
let rg=document.querySelector('[data-recurring-generate]');if(rg)rg.onclick=()=>{ensureRecurringForMonth(month,true);render()};
let rs=document.querySelector('[data-reset]');if(rs)rs.onclick=()=>{if(confirm('Attention : une sauvegarde sera créée avant la réinitialisation. Continuer ?')){createBackup('avant réinitialisation');state=normalizeState(D);localStorage.setItem(KEY,JSON.stringify(state));render()}}}
function editTx(id){let old=id?state.transactions.find(t=>t.id===id):null,t=normalizeMovement(old||{id:'u'+Date.now(),month,day:new Date().getDate(),description:'',amount:0,category:'Dépenses',subcategory:'',pointed:false,type:'expense',fromAccount:'checking',toAccount:null});let cats=Object.keys(state.categories);document.querySelector('#modal').hidden=false;document.querySelector('#modal').innerHTML=`<div class="sheet"><h2>${old?'Modifier':'Nouveau'} mouvement</h2><div class="field"><label>Type</label><select id="ftype">${MOVEMENT_TYPES.map(x=>`<option value="${x.id}" ${x.id===t.type?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div><div class="field"><label>Mois budgétaire</label><select id="fbudgetmonth">${state.months.map((m,i)=>`<option value="${i}" ${i===(Number.isInteger(t.budgetMonth)?t.budgetMonth:t.month)?'selected':''}>${m.month}</option>`).join('')}</select></div><div class="field"><label>Jour</label><input id="fday" type="number" min="1" max="31" value="${t.day||''}"></div><div class="field"><label>Désignation</label><input id="fdesc" value="${esc(t.description)}"></div><div class="field"><label>Montant (€)</label><input id="famount" type="number" step="0.01" value="${t.amount}"></div><div class="field" id="fromWrap"><label>Compte de départ</label><select id="ffrom">${ACCOUNTS.map(x=>`<option value="${x.id}" ${x.id===t.fromAccount?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div><div class="field" id="toWrap"><label>Compte d’arrivée</label><select id="fto">${ACCOUNTS.map(x=>`<option value="${x.id}" ${x.id===t.toAccount?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div><div class="field"><label>Catégorie</label><select id="fcat">${cats.map(c=>`<option ${c===t.category?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Sous-catégorie</label><select id="fsub"></select></div><label class="check"><input id="fpoint" type="checkbox" ${t.pointed?'checked':''}> Opération pointée</label><div class="actions">${old?'<button class="btn danger" id="del">Supprimer</button>':''}<button class="btn secondary" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div></div>`;let type=document.querySelector('#ftype'),cat=document.querySelector('#fcat'),sub=document.querySelector('#fsub'),from=document.querySelector('#ffrom'),to=document.querySelector('#fto');function subs(){let list=state.categories[cat.value]||[];sub.innerHTML='<option value="">—</option>'+list.map(x=>`<option ${x===t.subcategory?'selected':''}>${esc(x)}</option>`).join('')}function syncType(){let v=type.value;document.querySelector('#fromWrap').style.display=(v==='income'||v==='refund')?'none':'block';document.querySelector('#toWrap').style.display=(v==='income'||v==='refund'||v==='savings_transfer'||v==='internal_transfer')?'block':'none';if(v==='income'||v==='refund'){to.value='checking';cat.value='Revenus'}if(v==='savings_transfer'){from.value='checking';to.value='savings'}subs()}cat.onchange=subs;type.onchange=syncType;subs();syncType();document.querySelector('#cancel').onclick=closeModal;document.querySelector('#ok').onclick=()=>{t.month=month;t.budgetMonth=+document.querySelector('#fbudgetmonth').value;t.day=+document.querySelector('#fday').value||null;t.description=document.querySelector('#fdesc').value.trim();t.amount=Math.abs(+document.querySelector('#famount').value||0);t.type=type.value;t.fromAccount=(t.type==='income'||t.type==='refund')?null:from.value;t.toAccount=(t.type==='income'||t.type==='refund'||t.type==='savings_transfer'||t.type==='internal_transfer')?to.value:null;t.category=(t.type==='income'||t.type==='refund')?'Revenus':cat.value;t.subcategory=sub.value;t.pointed=document.querySelector('#fpoint').checked;normalizeMovement(t);if(!old)state.transactions.push(t);save();closeModal();render()};let del=document.querySelector('#del');if(del)del.onclick=()=>{if(confirm('Supprimer ce mouvement ?')){state.transactions=state.transactions.filter(x=>x.id!==t.id);save();closeModal();render()}}}
function closeModal(){document.querySelector('#modal').hidden=true;document.querySelector('#modal').innerHTML=''}
function exportData(){let b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='budget-2026-sauvegarde.json';a.click();URL.revokeObjectURL(a.href)}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();alert('Sauvegarde restaurée.');render()}catch{alert('Fichier de sauvegarde invalide.')}};r.readAsText(f)}
document.querySelectorAll('.bottom button').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;let b=document.querySelector('#installBtn');b.hidden=false;b.onclick=()=>deferredPrompt.prompt()});if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');ensureRecurringForMonth(month);render();
