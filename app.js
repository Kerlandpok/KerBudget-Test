
const D=window.INITIAL_DATA, KEY='budget2026.test.v1', BACKUP_KEY='budget2026.test.backups', APP_VERSION='2.1.0-test', MAX_BACKUPS=12;
let state=load(), view='home', month=Math.max(0,Math.min(11,new Date().getFullYear()===2026?new Date().getMonth():0)), deferredPrompt=null;
function cloneData(v){return JSON.parse(JSON.stringify(v))}
function normalizeState(raw){const base=cloneData(D);if(!raw||typeof raw!=='object')return base;return {...base,...raw,months:Array.isArray(raw.months)?raw.months:base.months,transactions:Array.isArray(raw.transactions)?raw.transactions:base.transactions,categories:raw.categories&&typeof raw.categories==='object'?raw.categories:base.categories,meta:{...(raw.meta||{}),appVersion:APP_VERSION,lastOpenedAt:new Date().toISOString()}}}
function readBackups(){try{return JSON.parse(localStorage.getItem(BACKUP_KEY))||[]}catch(e){return[]}}
function writeBackups(v){localStorage.setItem(BACKUP_KEY,JSON.stringify(v.slice(0,MAX_BACKUPS)))}
function createBackup(reason='automatique'){try{const raw=localStorage.getItem(KEY);if(!raw)return;const data=JSON.parse(raw),signature=JSON.stringify(data.transactions||[]);let b=readBackups();if(b[0]&&b[0].signature===signature)return;b.unshift({id:'b'+Date.now(),date:new Date().toISOString(),reason,signature,data});writeBackups(b)}catch(e){console.warn(e)}}
function load(){try{const raw=localStorage.getItem(KEY);return raw?normalizeState(JSON.parse(raw)):normalizeState(D)}catch(e){const b=readBackups();return b.length?normalizeState(b[0].data):normalizeState(D)}}
function save(reason='modification'){if(localStorage.getItem(KEY))createBackup(reason);state.meta={...(state.meta||{}),appVersion:APP_VERSION,lastSavedAt:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(state))}
function downloadBackup(){createBackup('export manuel');const blob=new Blob([JSON.stringify({format:'KerBudget Backup',version:APP_VERSION,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='KerBudget-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)}
function importBackupFile(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result),incoming=p.state||p;if(!Array.isArray(incoming.transactions))throw 0;createBackup('avant import');state=normalizeState(incoming);localStorage.setItem(KEY,JSON.stringify(state));render();alert('Sauvegarde importée.')}catch(e){alert('Fichier de sauvegarde invalide.')}};r.readAsText(file)}
function recoverLatestBackup(){const b=readBackups();if(!b.length){alert('Aucune sauvegarde disponible.');return}if(confirm('Restaurer la sauvegarde du '+new Date(b[0].date).toLocaleString('fr-FR')+' ?')){state=normalizeState(cloneData(b[0].data));localStorage.setItem(KEY,JSON.stringify(state));render();alert('Sauvegarde restaurée.')}}
window.addEventListener('beforeunload',()=>createBackup('fermeture'));
const euro=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function mtx(i){return state.transactions.filter(t=>t.month===i)}
function isSavingsTransfer(t){const s=((t.category||'')+' '+(t.subcategory||'')+' '+(t.description||'')).toLowerCase();return s.includes('épargne')||s.includes('epargne')||s.includes('livret a')}
function totals(i){let ts=mtx(i),income=0,expense=0,pincome=0,pexpense=0;for(const t of ts){let rev=t.category.trim()==='Revenus';if(rev){income+=t.amount;if(t.pointed)pincome+=t.amount}else if(!isSavingsTransfer(t)){expense+=t.amount;if(t.pointed)pexpense+=t.amount}}return{income,expense,pincome,pexpense}}
function planned(i){let ls=state.months[i].budgetLines;return{income:ls.filter(x=>x.type==='income').reduce((a,b)=>a+b.planned,0),expense:ls.filter(x=>x.type==='expense').reduce((a,b)=>a+b.planned,0)}}
function cashTotals(i){let income=0,outflow=0,pincome=0,poutflow=0;for(const t of mtx(i)){let rev=t.category.trim()==='Revenus';if(rev){income+=t.amount;if(t.pointed)pincome+=t.amount}else{outflow+=t.amount;if(t.pointed)poutflow+=t.amount}}return{income,outflow,pincome,poutflow}}
function balance(i,pointed=true){let prev=i===0?state.months[0].openingBalance:balance(i-1,pointed),t=cashTotals(i);return prev+(pointed?t.pincome:t.income)-(pointed?t.poutflow:t.outflow)}
function monthbar(){return `<div class="monthbar">${state.months.map((m,i)=>`<button data-month="${i}" class="${i===month?'active':''}">${m.month}</button>`).join('')}</div>`}
function layout(inner){return `<div class="wrap">${inner}</div>`}
function isBill(t){
  const billCats=new Set(['Habitation','Télécommunications','Assurances','Banque','Impots']);
  const s=((t.category||'')+' '+(t.subcategory||'')+' '+(t.description||'')).toLowerCase();
  const works=s.includes('aménagement')||s.includes('amenagement')||s.includes('travaux');
  return t.category.trim()!=='Revenus'&&billCats.has(t.category.trim())&&!works&&!isSavingsTransfer(t);
}
function savingsGoal(){
  const rows=(window.KERBUDGET_EXCEL_EXTRA?.Epargne||[]);
  const total=rows.find(r=>r&&String(r[1]).toLowerCase()==='total');
  const target=Number(total?.[2]||0), current=Number(total?.[5]||0);
  return {target,current,percent:target>0?Math.max(0,Math.min(100,current/target*100)):0};
}
function remainingDays(i){
  const today=new Date(), year=2026, last=new Date(year,i+1,0).getDate();
  if(today.getFullYear()<year||today.getMonth()<i)return last;
  if(today.getFullYear()>year||today.getMonth()>i)return 0;
  return Math.max(1,last-today.getDate()+1);
}
function home(){
  const t=totals(month),p=planned(month),available=balance(month,true),realBalance=balance(month,false);
  const pendingBills=mtx(month).filter(x=>isBill(x)&&!x.pointed).sort((a,b)=>(a.day||99)-(b.day||99));
  const pendingBillsTotal=pendingBills.reduce((a,b)=>a+(Number(b.amount)||0),0);
  const days=remainingDays(month),budgetLeft=p.expense-t.expense,daily=days>0?budgetLeft/days:0;
  const savings=savingsGoal(),delta=(t.pincome-t.pexpense)-(p.income-p.expense);
  let cat={};for(const x of mtx(month).filter(x=>x.category.trim()!=='Revenus'&&x.pointed&&!isSavingsTransfer(x)))cat[x.category]=(cat[x.category]||0)+x.amount;
  const cats=Object.entries(cat).sort((a,b)=>b[1]-a[1]).slice(0,6);
  return layout(`${monthbar()}
    <section class="dashboard-hero">
      <div class="dashboard-main">
        <span class="dashboard-kicker">ARGENT RÉELLEMENT DISPONIBLE</span>
        <strong class="dashboard-balance ${available>=0?'':'negative'}">${euro(available)}</strong>
        <small>Solde pointé, virements vers l’épargne déjà retirés</small>
      </div>
      <div class="dashboard-side">
        <div><span>Reste à dépenser par jour</span><b class="${daily>=0?'positive':'negative'}">${euro(daily)}</b><small>${days?days+' jour'+(days>1?'s':'')+' restant'+(days>1?'s':''):'Mois terminé'}</small></div>
        <div><span>Factures encore à pointer</span><b class="${pendingBillsTotal?'warning':''}">${euro(pendingBillsTotal)}</b><small>${pendingBills.length} facture${pendingBills.length>1?'s':''}</small></div>
      </div>
    </section>
    <div class="dashboard-cards">
      <div class="metric-card"><span>Revenus pointés</span><strong class="positive">${euro(t.pincome)}</strong></div>
      <div class="metric-card"><span>Dépenses réelles</span><strong class="negative">${euro(t.expense)}</strong><small>Épargne exclue</small></div>
      <div class="metric-card"><span>Reste du budget</span><strong class="${budgetLeft>=0?'positive':'negative'}">${euro(budgetLeft)}</strong></div>
      <div class="metric-card"><span>Solde avec tout enregistré</span><strong class="${realBalance>=0?'positive':'negative'}">${euro(realBalance)}</strong></div>
    </div>
    ${pendingBills.length?`<div class="section-title"><h2>Factures à pointer</h2><button class="btn secondary" data-go="transactions">Tout voir</button></div>
    <div class="priority-list">${pendingBills.slice(0,5).map(x=>`<div class="priority-row" data-edit="${esc(x.id)}"><div><b>${esc(x.description||x.subcategory||'Facture')}</b><small>${x.day?'Prévue le '+String(x.day).padStart(2,'0')+'/'+String(month+1).padStart(2,'0'):'Date non renseignée'} · ${esc(x.category)}</small></div><strong>${euro(x.amount)}</strong></div>`).join('')}</div>`:''}
    <div class="section-title"><h2>Objectif d’épargne</h2><button class="btn secondary" data-go="savings">Détails</button></div>
    <section class="saving-goal"><div class="saving-goal-head"><div><span>Progression annuelle</span><strong>${euro(savings.current)} / ${euro(savings.target)}</strong></div><b>${Math.round(savings.percent)} %</b></div><div class="saving-progress"><i style="width:${savings.percent}%"></i></div></section>
    <div class="section-title"><h2>Dépenses par catégorie</h2><button class="btn secondary" data-go="budget">Budget</button></div>
    <div class="list">${cats.length?cats.map(([c,v])=>`<div class="row"><div><div class="title">${esc(c)}</div><div class="progress"><i style="width:${Math.min(100,v/(t.pexpense||1)*100)}%"></i></div></div><div class="amount">${euro(v)}</div></div>`).join(''):'<div class="empty">Aucune dépense pointée.</div>'}</div>
    <div class="section-title"><h2>Derniers mouvements</h2><button class="btn secondary" data-go="transactions">Tout voir</button></div>${txList(mtx(month).slice(-6).reverse())}<button class="fab" data-add>+</button>`)
}
function txList(list){return `<div class="list">${list.length?list.map(t=>`<div class="row" data-edit="${esc(t.id)}"><div><div class="title">${t.pointed?'✓ ':''}${esc(t.description||t.subcategory||'Mouvement')}</div><div class="sub">${t.day?String(t.day).padStart(2,'0')+'/':''}${String(t.month+1).padStart(2,'0')}/2026 · ${esc(t.category)}${t.subcategory?' › '+esc(t.subcategory):''}</div></div><div class="amount ${t.category.trim()==='Revenus'?'positive':'negative'}">${t.category.trim()==='Revenus'?'+':'−'}${euro(Math.abs(t.amount))}</div></div>`).join(''):'<div class="empty">Aucun mouvement.</div>'}</div>`}
function txGroups(list){
  const billCats=new Set(['Habitation','Télécommunications','Assurances','Banque','Impots']);
  const isWorks=t=>{
    const s=((t.category||'')+' '+(t.subcategory||'')+' '+(t.description||'')).toLowerCase();
    return s.includes('aménagement')||s.includes('amenagement')||s.includes('travaux');
  };
  const revenus=list.filter(t=>t.category.trim()==='Revenus');
  const factures=list.filter(t=>t.category.trim()!=='Revenus'&&billCats.has(t.category.trim())&&!isWorks(t)&&!isSavingsTransfer(t));
  const autres=list.filter(t=>t.category.trim()!=='Revenus'&&(!billCats.has(t.category.trim())||isWorks(t)||isSavingsTransfer(t)));
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
function transactions(){let list=mtx(month).slice().sort((a,b)=>(b.day||0)-(a.day||0));return layout(`${monthbar()}<div class="section-title"><h2>Mouvements • ${state.months[month].month}</h2><button class="btn" data-add>+ Ajouter</button></div><input class="search" id="search" placeholder="Rechercher dans les mouvements…"> <div id="txarea" style="margin-top:12px">${txGroups(list)}</div>`)}
function budget(){let ls=state.months[month].budgetLines, groups={};for(const l of ls)(groups[l.type==='income'?'Revenus':l.category]??=[]).push(l);return layout(`${monthbar()}<div class="section-title"><h2>Budget prévu • ${state.months[month].month}</h2><button class="btn secondary" data-go="home">Terminé</button></div><div class="list">${Object.entries(groups).map(([g,ls])=>`<div class="cathead">${esc(g)}</div>${ls.map((l,idx)=>{let gi=state.months[month].budgetLines.indexOf(l);let actual=mtx(month).filter(t=>l.type==='income'?t.category.trim()==='Revenus':t.category.trim()===g.trim()).reduce((a,b)=>a+b.amount,0);return `<div class="budgetrow"><div><b>${esc(l.label)}</b><small>${l.type==='income'?'Revenu':'Dépense'}</small></div><input type="number" step="0.01" value="${l.planned}" data-budget="${gi}"><div class="actual">${euro(actual)}</div></div>`}).join('')}`).join('')}</div><p class="muted">Colonne centrale : montant anticipé modifiable. À droite : réel actuel de la catégorie.</p>`)}
function annual(){let arr=state.months.map((m,i)=>{let t=totals(i),p=planned(i);return{m:m.month.slice(0,3),inc:t.income,exp:t.expense,planned:p.expense,bal:t.income-t.expense}});let inc=arr.reduce((a,b)=>a+b.inc,0),exp=arr.reduce((a,b)=>a+b.exp,0),bud=arr.reduce((a,b)=>a+b.planned,0),mx=Math.max(...arr.map(x=>Math.abs(x.bal)),1);return layout(`<div class="section-title"><h2>Synthèse annuelle 2026</h2></div><div class="kpi3"><div class="card"><div class="cap">REVENUS</div><div class="val positive">${euro(inc)}</div></div><div class="card"><div class="cap">DÉPENSES</div><div class="val negative">${euro(exp)}</div></div><div class="card"><div class="cap">SOLDE</div><div class="val ${inc-exp>=0?'positive':'negative'}">${euro(inc-exp)}</div></div></div><div class="card" style="margin-top:12px"><div class="cap">SOLDE MENSUEL</div><div class="chart">${arr.map(x=>`<div class="barcol"><div class="bar ${x.bal<0?'neg':''}" style="height:${Math.max(3,Math.abs(x.bal)/mx*130)}px"></div><span>${x.m}</span></div>`).join('')}</div></div><div class="section-title"><h2>Mois par mois</h2></div><div class="list">${arr.map((x,i)=>`<div class="row" data-monthgo="${i}"><div><div class="title">${state.months[i].month}</div><div class="sub">Budget dépenses ${euro(x.planned)} · Réel ${euro(x.exp)}</div></div><div class="amount ${x.bal>=0?'positive':'negative'}">${euro(x.bal)}</div></div>`).join('')}</div>`)}
function savings(){
  const rows=(window.KERBUDGET_EXCEL_EXTRA?.Epargne||[]);
  const data=rows.slice(4).filter(r=>r && r[1]);
  const opening=data.find(r=>String(r[1]).toLowerCase().includes('solde précédent'));
  const months=data.filter(r=>/janvier|février|fevrier|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|décembre|decembre/i.test(String(r[1])));
  const total=data.find(r=>String(r[1]).toLowerCase()==='total');
  const pointed=total ? Number(total[5]||0) : 0;
  const real=total ? Number(total[3]||0) : 0;
  const planned=total ? Number(total[2]||0) : 0;
  return layout(`
    <section class="hero">
      <div class="label">Épargne • Livret A</div>
      <div class="big">${euro(pointed)}</div>
      <div class="hero-grid">
        <div class="hero-mini">Solde précédent<b>${euro(opening?.[5] ?? opening?.[3] ?? 0)}</b></div>
        <div class="hero-mini">Objectif annuel<b>${euro(planned)}</b></div>
        <div class="hero-mini">Réel annuel<b>${euro(real)}</b></div>
        <div class="hero-mini">Pointé<b>${euro(pointed)}</b></div>
      </div>
    </section>
    <div class="section-title"><h2>Épargne mois par mois</h2></div>
    <div class="list">
      ${months.map(r=>`
        <div class="row">
          <div>
            <div class="title">${esc(r[1])}</div>
            <div class="sub">Prévu ${euro(r[2])} · Réel ${euro(r[3])} · Écart ${euro(r[4])}</div>
          </div>
          <div class="amount ${Number(r[5]||0)>=0?'positive':'negative'}">${euro(r[5])}</div>
        </div>`).join('')}
    </div>
  `)
}
function solar(){let paid=state.transactions.filter(t=>/sygma/i.test(t.subcategory)||/sygma/i.test(t.description)).filter(t=>t.pointed).reduce((a,b)=>a+b.amount,0),start=13819.47,remain=Math.max(0,start-paid);return layout(`<div class="hero"><div class="label">Prêt photovoltaïque</div><div class="big">${euro(remain)}</div><div class="hero-grid"><div class="hero-mini">Montant initial<b>${euro(start)}</b></div><div class="hero-mini">Payé / pointé<b>${euro(paid)}</b></div></div></div><div class="section-title"><h2>Échéancier</h2></div><div class="list">${state.solar.map(x=>`<div class="row"><div><div class="title">Échéance ${x.n} · ${esc(x.month)}</div><div class="sub">Montant prévu</div></div><div class="amount">${euro(x.scheduled)}</div></div>`).join('')}</div>`)}
function more(){const b=readBackups(),last=b[0]?new Date(b[0].date).toLocaleString('fr-FR'):'Aucune';return layout(`<div class="section-title"><h2>Outils</h2></div><div class="settings-grid"><section class="settings-card"><h3>🔒 Sécurité des données</h3><p>Les mises à jour conservent les données enregistrées sur cet appareil.</p><div class="security-status"><div><span>Version</span><strong>KerBudget 2.1 Test</strong></div><div><span>Sauvegardes locales</span><strong>${b.length}</strong></div><div><span>Dernière sauvegarde</span><strong>${last}</strong></div></div><div class="action-stack"><button class="btn" data-backup-download>Exporter une sauvegarde</button><button class="btn secondary" data-backup-import>Importer une sauvegarde</button><button class="btn secondary" data-backup-restore>Restaurer la dernière sauvegarde locale</button><input type="file" id="backupFileInput" accept="application/json,.json" hidden></div></section><section class="settings-card"><h3>☀ Prêt photovoltaïque</h3><button class="btn secondary" data-go="solar">Ouvrir l'échéancier</button></section><section class="settings-card"><h3>Maintenance</h3><button class="btn secondary" data-export>Exporter les données brutes</button><button class="btn secondary" data-import>Importer les données brutes</button><input id="fileInput" type="file" accept="application/json" hidden><button class="btn danger" data-reset>Réinitialiser depuis Excel</button></section></div>`)}
function render(){let html=view==='home'?home():view==='transactions'?transactions():view==='annual'?annual():view==='savings'?savings():view==='budget'?budget():view==='solar'?solar():more();document.querySelector('#app').innerHTML=html;document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));bind()}
function bind(){document.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{month=+b.dataset.month;render()});document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{view=b.dataset.go;render()});document.querySelectorAll('[data-monthgo]').forEach(b=>b.onclick=()=>{month=+b.dataset.monthgo;view='home';render()});document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>editTx());document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit));document.querySelectorAll('[data-budget]').forEach(i=>i.onchange=()=>{state.months[month].budgetLines[+i.dataset.budget].planned=+i.value||0;save()});let q=document.querySelector('#search');if(q)q.oninput=()=>{let s=q.value.toLowerCase(),l=mtx(month).filter(t=>(t.description+' '+t.category+' '+t.subcategory).toLowerCase().includes(s));document.querySelector('#txarea').innerHTML=txGroups(l);document.querySelectorAll('[data-edit]').forEach(r=>r.onclick=()=>editTx(r.dataset.edit))};let ex=document.querySelector('[data-export]');if(ex)ex.onclick=exportData;let im=document.querySelector('[data-import]');if(im)im.onclick=()=>document.querySelector('#fileInput').click();let fi=document.querySelector('#fileInput');if(fi)fi.onchange=importData;let bd=document.querySelector('[data-backup-download]');if(bd)bd.onclick=downloadBackup;let bi=document.querySelector('[data-backup-import]');if(bi)bi.onclick=()=>document.querySelector('#backupFileInput').click();let bf=document.querySelector('#backupFileInput');if(bf)bf.onchange=e=>{if(e.target.files[0])importBackupFile(e.target.files[0])};let br=document.querySelector('[data-backup-restore]');if(br)br.onclick=recoverLatestBackup;let rs=document.querySelector('[data-reset]');if(rs)rs.onclick=()=>{if(confirm('Attention : une sauvegarde sera créée avant la réinitialisation. Continuer ?')){createBackup('avant réinitialisation');state=normalizeState(D);localStorage.setItem(KEY,JSON.stringify(state));render()}}}
function editTx(id){let old=id?state.transactions.find(t=>t.id===id):null,t=old||{id:'u'+Date.now(),month,day:new Date().getDate(),description:'',amount:0,category:'Dépenses',subcategory:'',pointed:false};let cats=Object.keys(state.categories);document.querySelector('#modal').hidden=false;document.querySelector('#modal').innerHTML=`<div class="sheet"><h2>${old?'Modifier':'Nouveau'} mouvement</h2><div class="field"><label>Jour</label><input id="fday" type="number" min="1" max="31" value="${t.day||''}"></div><div class="field"><label>Désignation</label><input id="fdesc" value="${esc(t.description)}"></div><div class="field"><label>Montant (€)</label><input id="famount" type="number" step="0.01" value="${t.amount}"></div><div class="field"><label>Catégorie</label><select id="fcat">${cats.map(c=>`<option ${c===t.category?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Sous-catégorie</label><select id="fsub"></select></div><label class="check"><input id="fpoint" type="checkbox" ${t.pointed?'checked':''}> Opération pointée</label><div class="actions">${old?'<button class="btn danger" id="del">Supprimer</button>':''}<button class="btn secondary" id="cancel">Annuler</button><button class="btn" id="ok">Enregistrer</button></div></div>`;let cat=document.querySelector('#fcat'),sub=document.querySelector('#fsub');function subs(){let list=state.categories[cat.value]||[];sub.innerHTML='<option value="">—</option>'+list.map(x=>`<option ${x===t.subcategory?'selected':''}>${esc(x)}</option>`).join('')}cat.onchange=subs;subs();document.querySelector('#cancel').onclick=closeModal;document.querySelector('#ok').onclick=()=>{t.month=month;t.day=+document.querySelector('#fday').value||null;t.description=document.querySelector('#fdesc').value.trim();t.amount=+document.querySelector('#famount').value||0;t.category=cat.value;t.subcategory=sub.value;t.pointed=document.querySelector('#fpoint').checked;if(!old)state.transactions.push(t);save();closeModal();render()};let del=document.querySelector('#del');if(del)del.onclick=()=>{if(confirm('Supprimer ce mouvement ?')){state.transactions=state.transactions.filter(x=>x.id!==t.id);save();closeModal();render()}}}
function closeModal(){document.querySelector('#modal').hidden=true;document.querySelector('#modal').innerHTML=''}
function exportData(){let b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='budget-2026-sauvegarde.json';a.click();URL.revokeObjectURL(a.href)}
function importData(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();alert('Sauvegarde restaurée.');render()}catch{alert('Fichier de sauvegarde invalide.')}};r.readAsText(f)}
document.querySelectorAll('.bottom button').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;let b=document.querySelector('#installBtn');b.hidden=false;b.onclick=()=>deferredPrompt.prompt()});if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');render();
