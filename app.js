const $ = (id)=>document.getElementById(id);
const money = (n)=>'$'+Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2});
let currentUser = null;
let currentEventId = null;
let currentTab = 'info';

let db = JSON.parse(localStorage.getItem('gi_erp_v6')) || {
  users:[
    {user:'admin', pass:'admin123', role:'owner', name:'Administrador principal'},
    {user:'lector', pass:'lector123', role:'reader', name:'Administrador solo lectura'},
    {user:'agenda', pass:'agenda123', role:'member', name:'Integrante'}
  ],
  members:[
    {id:1,name:'Pedro López',instrument:'Sax',baseSalary:2000,active:true},
    {id:2,name:'Luis García',instrument:'Teclado',baseSalary:1800,active:true}
  ],
  events:[
    {id:1,type:'Boda',client:'Juan Pérez',phone:'6440000000',place:'Jardín Los Álamos',date:'2026-08-15',time:'18:00',amount:25000,
     charges:[{type:'Anticipo',date:'2026-06-25',amount:15000,comment:'Apartado'}],
     expenses:[{type:'Gasolina',date:'2026-08-15',amount:800,desc:'Traslado'}],
     participants:[{name:'Pedro López',instrument:'Sax',salary:2000,paid:false},{name:'Luis García',instrument:'Teclado',salary:1800,paid:false}],
     admins:[{name:'Admin 1',amount:0,paid:false},{name:'Admin 2',amount:0,paid:false},{name:'Admin 3',amount:0,paid:false}],
     attachments:[]
    }
  ]
};

function save(){localStorage.setItem('gi_erp_v6', JSON.stringify(db)); renderAll();}
function sum(arr,key){return arr.reduce((a,b)=>a+Number(b[key]||0),0)}
function eventIncome(e){return sum(e.charges||[],'amount')}
function eventExpenses(e){return sum(e.expenses||[],'amount')}
function eventSalaries(e){return sum(e.participants||[],'salary')}
function adminBase(e){return Math.max(0,eventIncome(e)-eventExpenses(e)-eventSalaries(e))}
function normalizeAdmins(e){ if(!e.admins)e.admins=[]; const base=adminBase(e)/3; e.admins.forEach(a=>{ if(!a.manual) a.amount=base; }); }
function isReadOnly(){return currentUser?.role==='reader' || currentUser?.role==='member'}

function login(){
  const u = db.users.find(x=>x.user===$('loginUser').value && x.pass===$('loginPass').value);
  if(!u){ alert('Usuario o contraseña incorrectos'); return; }
  currentUser = u;
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('roleLabel').textContent = u.name;
  buildNav();
  showScreen(u.role==='member'?'agenda':'dashboard');
}
function logout(){location.reload();}

function buildNav(){
  const nav = $('bottomNav');
  const full = [
    ['dashboard','🏠','Dashboard'],['agenda','📅','Agenda'],['events','🎷','Eventos'],
    ['members','👥','Integrantes'],['cashbox','💵','Caja'],['settings','⚙️','Config.']
  ];
  const items = currentUser.role==='member' ? [['agenda','📅','Agenda']] : full;
  nav.innerHTML = items.map(i=>`<button id="nav-${i[0]}" onclick="showScreen('${i[0]}')">${i[1]}<br>${i[2]}</button>`).join('');
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active-nav'));
  const navBtn = $('nav-'+id); if(navBtn) navBtn.classList.add('active-nav');
  const titles={dashboard:'Dashboard',agenda:'Agenda',events:'Eventos',eventDetail:'Evento',members:'Integrantes',cashbox:'Caja',settings:'Configuración'};
  $('screenTitle').textContent=titles[id]||'Grupo Innova ERP';
  renderAll();
}
function renderAll(){ db.events.forEach(normalizeAdmins); renderDashboard(); renderAgenda(); renderEvents(); renderMembers(); renderCashbox(); applyPermissions(); }

function renderDashboard(){
  const cash = db.events.reduce((a,e)=>a+eventIncome(e)-eventExpenses(e),0)
    - db.events.flatMap(e=>e.participants||[]).filter(p=>p.paid).reduce((a,p)=>a+Number(p.salary||0),0)
    - db.events.flatMap(e=>e.admins||[]).filter(p=>p.paid).reduce((a,p)=>a+Number(p.amount||0),0);
  const pending = db.events.reduce((a,e)=>a+Math.max(0,Number(e.amount||0)-eventIncome(e)),0);
  const salaries = db.events.flatMap(e=>e.participants||[]).filter(p=>!p.paid).reduce((a,p)=>a+Number(p.salary||0),0);
  const admins = db.events.flatMap(e=>e.admins||[]).filter(p=>!p.paid).reduce((a,p)=>a+Number(p.amount||0),0);
  $('kpiCash').textContent=money(cash); $('kpiPending').textContent=money(pending); $('kpiMusicians').textContent=money(salaries); $('kpiAdmins').textContent=money(admins); $('kpiFree').textContent=money(cash-salaries-admins);
  $('dashboardEvents').innerHTML = upcoming().slice(0,3).map(eventCard).join('') || '<p class="muted">Sin eventos próximos.</p>';
}
function upcoming(){ const t=new Date().toISOString().slice(0,10); return db.events.filter(e=>e.date>=t).sort((a,b)=>a.date.localeCompare(b.date));}
function renderAgenda(){ $('agendaList').innerHTML = upcoming().map(e=>`<div class="event-card"><div class="row"><div><b>${e.date}</b><br>${e.time||''}<br>${e.type}<br>${e.place}</div><span class="badge">Agenda</span></div></div>`).join('') || '<p class="muted">Sin fechas próximas.</p>'; }
function eventCard(e){return `<div class="event-card" onclick="openEvent(${e.id})"><div class="row"><div><b>${e.type}</b><br>${e.client}<br>${e.date} · ${e.time||''}<br><span class="muted">${e.place}</span></div><div><b>${money(e.amount)}</b><br><span class="badge">Pend. ${money(Math.max(0,e.amount-eventIncome(e)))}</span></div></div></div>`}
function renderEvents(){ const q=($('eventSearch')?.value||'').toLowerCase(); $('eventList').innerHTML=db.events.filter(e=>[e.type,e.client,e.date,e.place].join(' ').toLowerCase().includes(q)).map(eventCard).join('') || '<p class="muted">No hay eventos.</p>'; }
function openEvent(id){currentEventId=id; currentTab='info'; showScreen('eventDetail'); renderEventDetail();}
function renderEventDetail(){
  const e=db.events.find(x=>x.id===currentEventId); if(!e)return;
  $('eventHeader').innerHTML=`<h2>${e.type} · ${e.date}</h2><p>${e.client} · ${e.place}</p><b>${money(e.amount)}</b>`;
  showEventTab(currentTab);
}
function showEventTab(tab){
  currentTab=tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  [...document.querySelectorAll('.tab')].find(x=>x.textContent.toLowerCase().startsWith(tab==='admins'?'administrativos':tab))?.classList.add('active');
  const e=db.events.find(x=>x.id===currentEventId);
  let html='';
  if(tab==='info') html=`<h2>Información</h2><p><b>Cliente:</b> ${e.client}</p><p><b>Teléfono:</b> ${e.phone}</p><p><b>Lugar:</b> ${e.place}</p><p><b>Monto:</b> ${money(e.amount)}</p>`;
  if(tab==='cobros') html=`<h2>Cobros</h2>${adminBtn('Registrar cobro','addCharge()')}${(e.charges||[]).map(c=>`<div class="table-row"><div>${c.date}<br><b>${c.type}</b><br><span class="muted">${c.comment||''}</span></div><b>${money(c.amount)}</b></div>`).join('')}`;
  if(tab==='gastos') html=`<h2>Gastos</h2>${adminBtn('Registrar gasto','addExpense()')}${(e.expenses||[]).map(g=>`<div class="table-row"><div>${g.date}<br><b>${g.type}</b><br><span class="muted">${g.desc||''}</span></div><b>${money(g.amount)}</b></div>`).join('')}`;
  if(tab==='integrantes') html=`<h2>Integrantes</h2>${adminBtn('Agregar integrante','addParticipant()')}${(e.participants||[]).map((p,i)=>`<div class="table-row"><div><b>${p.name}</b><br>${p.instrument}<br>${money(p.salary)}</div><label><input type="checkbox" ${p.paid?'checked':''} onchange="toggleParticipant(${i})" ${isReadOnly()?'disabled':''}> Pagado</label></div>`).join('')}`;
  if(tab==='admins') html=`<h2>Administrativos</h2><p class="muted">Base: ${money(adminBase(e))}</p>${(e.admins||[]).map((a,i)=>`<div class="table-row"><div><b>${a.name}</b><br>${money(a.amount)}</div><label><input type="checkbox" ${a.paid?'checked':''} onchange="toggleAdmin(${i})" ${isReadOnly()?'disabled':''}> Pagado</label></div>`).join('')}`;
  if(tab==='adjuntos') html=`<h2>Adjuntos</h2><p class="muted">Contratos, imágenes, comprobantes y videos. Pendiente conectar a respaldo.</p>${adminBtn('Agregar adjunto','alert("Función pendiente")')}`;
  if(tab==='resumen') html=`<h2>Resumen</h2><p>Ingresos: <b>${money(eventIncome(e))}</b></p><p>Gastos: <b>${money(eventExpenses(e))}</b></p><p>Sueldos: <b>${money(eventSalaries(e))}</b></p><p>Utilidad admins: <b>${money(adminBase(e))}</b></p>`;
  $('eventTabContent').innerHTML=html;
}
function adminBtn(txt,fn){ return isReadOnly() ? '' : `<button class="btn primary" onclick="${fn}">${txt}</button>`; }

function openEventForm(){ $('eventDialog').showModal(); }
function saveEvent(ev){ ev.preventDefault(); const id=Date.now(); const members=db.members.filter(m=>m.active).map(m=>({name:m.name,instrument:m.instrument,salary:m.baseSalary,paid:false})); db.events.push({id,type:$('newType').value,client:$('newClient').value,phone:$('newPhone').value,place:$('newPlace').value,date:$('newDate').value,time:$('newTime').value,amount:Number($('newAmount').value||0),charges:[],expenses:[],participants:members,admins:[{name:'Admin 1',amount:0,paid:false},{name:'Admin 2',amount:0,paid:false},{name:'Admin 3',amount:0,paid:false}],attachments:[]}); $('eventDialog').close(); save(); }
function addCharge(){ const e=db.events.find(x=>x.id===currentEventId); e.charges.push({type:prompt('Tipo: Anticipo, Abono o Liquidación','Abono'),date:new Date().toISOString().slice(0,10),amount:Number(prompt('Monto')||0),comment:prompt('Comentarios','')}); save(); showEventTab('cobros');}
function addExpense(){ const e=db.events.find(x=>x.id===currentEventId); e.expenses.push({type:prompt('Tipo de gasto','Gasolina'),date:new Date().toISOString().slice(0,10),amount:Number(prompt('Monto')||0),desc:prompt('Descripción','')}); save(); showEventTab('gastos');}
function addParticipant(){ const e=db.events.find(x=>x.id===currentEventId); e.participants.push({name:prompt('Nombre'),instrument:prompt('Función'),salary:Number(prompt('Sueldo')||0),paid:false}); save(); showEventTab('integrantes');}
function toggleParticipant(i){ const e=db.events.find(x=>x.id===currentEventId); e.participants[i].paid=!e.participants[i].paid; save(); showEventTab('integrantes');}
function toggleAdmin(i){ const e=db.events.find(x=>x.id===currentEventId); e.admins[i].paid=!e.admins[i].paid; save(); showEventTab('admins');}

function renderMembers(){ $('memberList').innerHTML=db.members.filter(m=>m.active).map(m=>`<div class="member-card"><b>${m.name}</b><br>${m.instrument}<br>Sueldo base: ${money(m.baseSalary)}</div>`).join('');}
function addMember(){ const id=Date.now(); db.members.push({id,name:prompt('Nombre'),instrument:prompt('Instrumento / función'),baseSalary:Number(prompt('Sueldo base')||0),active:true}); save();}
function renderCashbox(){
  let saldo=0, rows=[];
  db.events.forEach(e=>{
    (e.charges||[]).forEach(c=>{saldo+=Number(c.amount||0); rows.push([c.date,`${c.type} · ${e.type}`,c.amount,0,saldo]);});
    (e.expenses||[]).forEach(g=>{saldo-=Number(g.amount||0); rows.push([g.date,`${g.type} · ${e.type}`,0,g.amount,saldo]);});
    (e.participants||[]).filter(p=>p.paid).forEach(p=>{saldo-=Number(p.salary||0); rows.push([e.date,`Sueldo ${p.name}`,0,p.salary,saldo]);});
    (e.admins||[]).filter(a=>a.paid).forEach(a=>{saldo-=Number(a.amount||0); rows.push([e.date,`Admin ${a.name}`,0,a.amount,saldo]);});
  });
  $('cashboxList').innerHTML=rows.map(r=>`<div class="table-row"><div>${r[0]}<br><b>${r[1]}</b><br><span class="muted">Entrada: ${money(r[2])} · Salida: ${money(r[3])}</span></div><b>${money(r[4])}</b></div>`).join('') || '<p class="muted">Sin movimientos.</p>';
}
function applyPermissions(){ document.querySelectorAll('.admin-only').forEach(el=>el.style.display=isReadOnly()?'none':'');}
