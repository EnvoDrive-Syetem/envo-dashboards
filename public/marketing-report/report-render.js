const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const B=['ebikebc','envo','moonbike','veemo'];
const n0=v=>Math.round(v).toLocaleString('en-CA');
const $=v=>'$'+n0(v);
const $k=v=>'$'+(v>=1000?(v/1000).toFixed(1)+'K':n0(v));
const k=v=>v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e4?(v/1e3).toFixed(0)+'K':v>=1e3?(v/1e3).toFixed(1)+'K':String(Math.round(v));
const pct=(a,b)=>b?((a-b)/b*100):null;
const dl=(a,b,invert)=>{const p=pct(a,b);if(p==null)return'<span class="d flat">new</span>';const c=Math.abs(p)<0.5?'flat':((p>0)!==!!invert?'up':'dn');return`<span class="d ${c}">${p>0?'▲':p<0?'▼':'–'} ${Math.abs(p).toFixed(1)}% vs prior wk</span>`};
// KPIs
const K=D.kpi;
document.getElementById('kpis').innerHTML=[
 ['B2C revenue',$(K.rev[0]),dl(K.rev[0],K.rev[1])],['B2C orders',K.orders[0],dl(K.orders[0],K.orders[1])],
 ['Bikes sold (B2C)',K.units[0],dl(K.units[0],K.units[1])],
 ['Ad spend',$(K.spend[0]),dl(K.spend[0],K.spend[1],true)],['ROAS (B2C)',K.roas[0].toFixed(2)+'x',dl(K.roas[0],K.roas[1])],
 ['Paid impressions',k(K.imp[0]),dl(K.imp[0],K.imp[1])],['CRM deals created',D.crm.n,'<span class="d flat">this week</span>'],
 ['Sessions (Canada)',n0(D.tr.ca.W.reduce((a,b)=>a+b)),dl(D.tr.ca.W.reduce((a,b)=>a+b),D.tr.ca.P.reduce((a,b)=>a+b))]
].map(x=>`<div class="kpi"><b>${x[0]}</b><span class="v">${x[1]}</span>${x[2]}</div>`).join('');
document.getElementById('lg').innerHTML=B.map((b,i)=>`<span><i style="background:var(--${b})"></i>${D.brands[i]}</span>`).join('')+'<span><i style="background:var(--prior)"></i>Prior week (grey)</span><span><i style="background:var(--meta)"></i>Meta</span><span><i style="background:var(--google)"></i>Google</span>';

// chart helpers
const valLabels={id:'vl',afterDatasetsDraw(ch){const o=ch.options.plugins.vl;if(!o||!o.on)return;const c=ch.ctx;c.save();c.font='600 11px Barlow,system-ui,sans-serif';c.fillStyle=css('--ink2');
 ch.data.datasets.forEach((ds,di)=>{if(ds.noLabel||ch.getDatasetMeta(di).hidden)return;ch.getDatasetMeta(di).data.forEach((el,i)=>{const v=ds.data[i];if(v==null||v===0&&!o.zero)return;const t=((ds.fmt&&ds.fmt.f)||FM[ch.canvas.id]||n0)(v);
  if(ch.options.indexAxis==='y'){c.textAlign='left';c.textBaseline='middle';c.fillText(t,el.x+4,el.y)}else{c.textAlign='center';c.textBaseline='bottom';c.fillText(t,el.x,el.y-3)}})});c.restore()}};
Chart.register(valLabels);
let charts=[];const FM={};
function mk(id,type,data,opt={}){FM[id]=opt.fmt;
  const horiz=opt.horiz,stack=opt.stack;
  const cfg={type,data,options:{responsive:true,maintainAspectRatio:false,indexAxis:horiz?'y':'x',animation:false,
   layout:{padding:{top:16,right:horiz?46:6}},
   plugins:{legend:{display:!!opt.legend,position:'bottom',labels:{boxWidth:10,boxHeight:10,color:css('--ink2'),font:{size:11}}},
     vl:{on:opt.labels!==false&&!stack,zero:opt.zero},
     tooltip:{callbacks:{label:c=>' '+(c.dataset.label?c.dataset.label+': ':'')+(((c.dataset.tfmt&&c.dataset.tfmt.f)||(c.dataset.fmt&&c.dataset.fmt.f)||opt.fmt||n0)(c.parsed[horiz?'x':'y']))+(opt.suffix||'')}}},
   scales:{x:{stacked:!!stack,grid:{display:!!horiz,color:css('--grid')},ticks:Object.assign({color:css('--ink2'),font:{size:11}},horiz?{callback:v=>(opt.fmt||n0)(v)}:{}),border:{color:css('--line')}},
           y:{stacked:!!stack,beginAtZero:true,grid:{display:!horiz,color:css('--grid')},ticks:Object.assign({color:css('--ink2'),font:{size:11}},horiz?{}:{callback:v=>(opt.fmt||n0)(v)}),border:{display:false}}}}};
  if(opt.extra)opt.extra(cfg);
  charts.push(new Chart(document.getElementById(id),cfg));
}
const bc=()=>B.map(b=>css('--'+b));
const pr=()=>css('--prior');
const wp=(w,p,fmt)=>({labels:D.brands,datasets:[{label:'Prior week',data:p,backgroundColor:pr(),maxBarThickness:22,borderRadius:3,fmt:{f:fmt}},{label:'This week',data:w,backgroundColor:bc(),maxBarThickness:22,borderRadius:3,fmt:{f:fmt}}]});
const fm2=v=>v==null?'–':v.toFixed(2)+'x';
function render(){
 charts.forEach(c=>c.destroy());charts=[];
 mk('c_rev','bar',wp(D.rev.W,D.rev.P,$k),{fmt:$k,extra:c=>{c.data.datasets.forEach(d=>d.tfmt={f:$})}});
 mk('c_ord','bar',wp(D.orders.W,D.orders.P));
 mk('c_chan','bar',{labels:D.brands,datasets:[{label:'Online',data:D.online,backgroundColor:css('--accent'),maxBarThickness:34},{label:'Staff-created (in-store/phone)',data:D.staff,backgroundColor:pr(),maxBarThickness:34}]},{stack:true,legend:true});
 mk('c_po','bar',{labels:D.prod.names,datasets:[{label:'Orders',data:D.prod.orders,backgroundColor:css('--accent'),maxBarThickness:18,borderRadius:3,fmt:{f:(v)=>v}}]},{horiz:true});
 mk('c_pr','bar',{labels:D.prod.names,datasets:[{label:'Revenue',data:D.prod.rev,backgroundColor:css('--accent'),maxBarThickness:18,borderRadius:3}]},{horiz:true,fmt:$});
 const C=D.crm;
 mk('c_pipe','bar',{labels:C.pipes,datasets:[{label:'Deals',data:C.won.map((_,i)=>C.won[i]+C.pend[i]+C.open[i]+C.lost[i]),backgroundColor:css('--accent'),maxBarThickness:20,borderRadius:3}]},{horiz:true,fmt:v=>v});
 mk('c_src','bar',{labels:C.src,datasets:[{label:'Deals',data:C.srcn,backgroundColor:css('--accent'),maxBarThickness:20,borderRadius:3}]},{horiz:true});
 mk('c_stage','bar',{labels:C.pipes,datasets:[{label:'Won/paid/shipped',data:C.won,backgroundColor:css('--good')},{label:'Draft/pending pay',data:C.pend,backgroundColor:css('--veemo')},{label:'Open',data:C.open,backgroundColor:pr()},{label:'Archived/missed',data:C.lost,backgroundColor:css('--bad')}]},{horiz:true,stack:true,legend:true});
 mk('c_sp','bar',wp(D.spendT.W,D.spendT.P,$),{fmt:$});
 mk('c_spp','bar',{labels:D.brands,datasets:[{label:'Google',data:D.spend.G.W,backgroundColor:css('--google'),maxBarThickness:34},{label:'Meta',data:D.spend.M.W,backgroundColor:css('--meta'),maxBarThickness:34}]},{stack:true,legend:true,fmt:$});
 mk('c_spprod','bar',{labels:D.pr.names,datasets:[{label:'Spend',data:D.pr.spend,backgroundColor:css('--accent'),maxBarThickness:16,borderRadius:3}]},{horiz:true,fmt:$});
 const f2=v=>v.toFixed(2)+'%';
 const tip=(d)=>({callbacks:{afterLabel:c=>`Spend ${$(d.spend[c.dataIndex])} · ${n0(d.imp[c.dataIndex])} impr · ${n0(d.clk[c.dataIndex])} clicks`}});
 mk('c_ctrp','bar',{labels:D.pr.names,datasets:[{label:'CTR',data:D.pr.ctr,backgroundColor:css('--accent'),maxBarThickness:18,borderRadius:3}]},{horiz:true,fmt:f2,extra:c=>{c.options.plugins.tooltip.callbacks.afterLabel=tip(D.pr).callbacks.afterLabel}});
 mk('c_ctrc','bar',{labels:D.camp.names,datasets:[{label:'CTR',data:D.camp.ctr,backgroundColor:D.camp.names.map(n=>n.includes('(Meta)')?css('--meta'):css('--google')),maxBarThickness:18,borderRadius:3}]},{horiz:true,fmt:f2,extra:c=>{c.options.plugins.tooltip.callbacks.afterLabel=tip(D.camp).callbacks.afterLabel;c.options.scales.y.ticks.callback=function(v){const s=this.getLabelForValue(v);return s.length>30?s.slice(0,29)+'…':s}}});
 const L5=[...D.brands.map(b=>b=='Veemo'?'Veemo (no spend)':b),'All B2C'];const bc5=[...bc(),css('--ink')];
 mk('c_roas','bar',{labels:L5,datasets:[{label:'Prior week',data:D.roas.P,backgroundColor:pr(),maxBarThickness:30,borderRadius:3,fmt:{f:fm2}},{label:'This week',data:D.roas.W,backgroundColor:bc5,maxBarThickness:30,borderRadius:3,fmt:{f:fm2}}]},{fmt:fm2,extra:c=>{c.options.plugins.tooltip.callbacks.label=x=>' '+x.dataset.label+': '+(x.raw==null?'no ad spend':fm2(x.raw))}});
 mk('c_roasc','bar',{labels:L5,datasets:[{label:'Platform-claimed',data:D.roasClaim,backgroundColor:pr(),maxBarThickness:20,borderRadius:3,fmt:{f:fm2}},{label:'Shopify B2C',data:D.roas.W,backgroundColor:bc5,maxBarThickness:20,borderRadius:3,fmt:{f:fm2}}]},{fmt:fm2,legend:false,extra:c=>{c.options.plugins.tooltip.callbacks.label=x=>' '+x.dataset.label+': '+(x.raw==null?'no ad spend':fm2(x.raw))}});
 const ip=D.impPlat;
 mk('c_ip','bar',{labels:ip.names,datasets:[{label:'Impressions',data:ip.vals,backgroundColor:ip.names.map(n=>n.startsWith('Meta')?css('--meta'):css('--google')),maxBarThickness:18,borderRadius:3,fmt:{f:k},tfmt:{f:n0}}]},{horiz:true,fmt:k});
 mk('c_ib','bar',wp(D.impBrand.W,D.impBrand.P,k),{fmt:k});
 mk('c_org','bar',{labels:D.org.sites,datasets:[{label:'Prior week',data:D.org.P,backgroundColor:pr(),maxBarThickness:22,borderRadius:3,fmt:{f:k},tfmt:{f:n0}},{label:'This week',data:D.org.W,backgroundColor:bc(),maxBarThickness:22,borderRadius:3,fmt:{f:k},tfmt:{f:n0}}]},{fmt:k});
 const T=D.tr;
 mk('c_ss','bar',wp(T.sess.W,T.sess.P,k),{fmt:k,extra:c=>{c.data.datasets.forEach(d=>d.tfmt={f:n0})}});
 mk('c_ca','bar',wp(T.ca.W,T.ca.P,k),{fmt:k,extra:c=>{c.data.datasets.forEach(d=>d.tfmt={f:n0})}});
 mk('c_en','bar',wp(T.eng.W,T.eng.P,k),{fmt:k,extra:c=>{c.data.datasets.forEach(d=>d.tfmt={f:n0})}});
 const gcol=['--accent','--meta','--google','--moonbike','--envo','--prior'].map(css);
 mk('c_mix','bar',{labels:T.sites,datasets:T.groups.map((g,i)=>({label:g,data:T.mix[g],backgroundColor:gcol[i]}))},{horiz:true,stack:true,legend:true,fmt:k});

 const E=D.em;
 mk('e_fun','bar',{labels:['Recipients','Delivered','Opened (unique)','Clicked (unique)','Ordered'],datasets:[{label:'Count',data:[E.camp.recipients,E.camp.delivered,E.camp.opens_u,E.camp.clicks_u,E.camp.orders],backgroundColor:css('--moonbike'),maxBarThickness:22,borderRadius:3}]},{horiz:true,zero:true});
 mk('e_pop','bar',{labels:E.pop_days,datasets:[{label:'Signups',data:E.pop_sub,backgroundColor:E.pop_sub.map((_,i)=>i<7?pr():css('--moonbike')),maxBarThickness:16,borderRadius:3}]},{});
 const prt=E.pop_sub.map((v,i)=>+(v/E.pop_view[i]*100).toFixed(2));
 mk('e_snap','bar',{labels:E.pop_days,datasets:[{label:'Submit rate',data:prt,backgroundColor:prt.map((_,i)=>i<7?pr():css('--moonbike')),maxBarThickness:16,borderRadius:3}]},{fmt:v=>v.toFixed(1)+'%',labels:false,suffix:''});
 const KA=KLA;
 const kc=[css('--envo'),css('--moonbike'),css('--ebikebc'),css('--veemo'),css('--meta')];
 mk('a_sub','bar',{labels:KA.acc,datasets:[{label:'Submissions',data:KA.sub,backgroundColor:kc,maxBarThickness:22,borderRadius:3}]},{horiz:true});
 mk('a_rev','bar',{labels:KA.acc,datasets:[{label:'Campaigns',data:KA.crev,backgroundColor:css('--accent'),maxBarThickness:22},{label:'Flows',data:KA.frev,backgroundColor:pr(),maxBarThickness:22}]},{horiz:true,stack:true,legend:true,fmt:$k});
 mk('a_rate','bar',{labels:KA.forms.map(x=>x[0]+' · '+x[1]),datasets:[{label:'Submit rate',data:KA.forms.map(x=>x[5]),backgroundColor:KA.forms.map(x=>kc[x[6]]),maxBarThickness:16,borderRadius:3}]},{horiz:true,fmt:v=>v.toFixed(2)+'%',extra:c=>{c.options.scales.y.ticks.callback=function(v){const s=this.getLabelForValue(v);return s.length>26?s.slice(0,25)+'…':s}}});
 const TT=TKD;
 mk('t_sp','bar',{labels:TT.ads.map(a=>a.id),datasets:[{label:'Spend',data:TT.ads.map(a=>a.sp),backgroundColor:css('--accent'),maxBarThickness:22,borderRadius:3}]},{fmt:v=>'$'+v.toFixed(2)});
 mk('t_ic','bar',{labels:TT.ads.map(a=>a.id),datasets:[{label:'Impressions',data:TT.ads.map(a=>a.imp),backgroundColor:pr(),maxBarThickness:18,borderRadius:3},{label:'Clicks',data:TT.ads.map(a=>a.clk),backgroundColor:css('--accent'),maxBarThickness:18,borderRadius:3}]},{legend:true,fmt:n0});
 mk('t_ctr','bar',{labels:TT.ads.map(a=>a.id),datasets:[{label:'CTR',data:TT.ads.map(a=>a.ctr),backgroundColor:css('--accent'),maxBarThickness:22,borderRadius:3}]},{fmt:v=>v.toFixed(2)+'%'});
 const Y=MB,yl=Y.w26.map(w=>{const d=new Date(w+'T00:00:00');return d.toLocaleDateString('en-CA',{month:'short',day:'numeric'})});
 const yb=(k,fmt,sc)=>({labels:yl,datasets:[{label:'2025',data:Y.y25[k].map(v=>sc?v/sc:v),backgroundColor:pr(),maxBarThickness:16,borderRadius:3},{label:'2026',data:Y.y26[k].map(v=>sc?v/sc:v),backgroundColor:css('--moonbike'),maxBarThickness:16,borderRadius:3}]});
 mk('y_rev','bar',yb('rev'),{legend:true,fmt:$k});
 mk('y_ord','bar',yb('orders'),{legend:true,zero:true});
 mk('y_bk','bar',yb('units'),{legend:true,zero:true});
 mk('y_sp','bar',yb('spend'),{legend:true,fmt:$k});
 mk('y_im','bar',yb('imp'),{legend:true,fmt:k});
 mk('y_dl','bar',yb('deals'),{legend:true,zero:true});
 const ro=y=>Y[y].rev.map((r,i)=>Y[y].spend[i]?+(r/Y[y].spend[i]).toFixed(2):0), cd=y=>Y[y].spend.map((s,i)=>Y[y].deals[i]?Math.round(s/Y[y].deals[i]):0);
 mk('y_ro','bar',{labels:yl,datasets:[{label:'2025',data:ro('y25'),backgroundColor:pr(),maxBarThickness:20,borderRadius:3},{label:'2026',data:ro('y26'),backgroundColor:css('--moonbike'),maxBarThickness:20,borderRadius:3}]},{legend:true,fmt:v=>v.toFixed(1)+'x'});
 mk('y_cd','bar',{labels:yl,datasets:[{label:'2025',data:cd('y25'),backgroundColor:pr(),maxBarThickness:20,borderRadius:3},{label:'2026',data:cd('y26'),backgroundColor:css('--moonbike'),maxBarThickness:20,borderRadius:3}]},{legend:true,fmt:$});
 // sparklines
 const sp=document.getElementById('spark');
 if(!sp.children.length){T.sites.forEach((s,i)=>{const d=document.createElement('div');d.innerHTML=`<small>${s} · ${n0(T.sess.W[i])} sessions</small><div class="ch sm"><canvas id="sp${i}"></canvas></div>`;sp.appendChild(d)})}
 T.sites.forEach((s,i)=>{const col=css('--'+B[i]);
  const wk={id:'wk',afterDraw(ch){const x=ch.scales.x.getPixelForValue(7)-ch.scales.x.width/(2*14);const c=ch.ctx;c.save();c.strokeStyle=css('--muted');c.setLineDash([3,3]);c.beginPath();c.moveTo(x,ch.chartArea.top);c.lineTo(x,ch.chartArea.bottom);c.stroke();c.restore()}};
  charts.push(new Chart(document.getElementById('sp'+i),{type:'line',data:{labels:T.days,datasets:[{data:T.daily[s],borderColor:col,backgroundColor:col+'22',fill:true,borderWidth:2,pointRadius:0,pointHoverRadius:4,tension:.25}]},
   options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:4}},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},vl:{on:false},tooltip:{callbacks:{label:c=>' '+n0(c.parsed.y)+' sessions'}}},
    scales:{x:{grid:{display:false},ticks:{color:css('--muted'),font:{size:10},maxTicksLimit:4},border:{color:css('--line')}},y:{beginAtZero:true,grid:{color:css('--grid')},ticks:{color:css('--muted'),font:{size:10},maxTicksLimit:3,callback:v=>k(v)},border:{display:false}}}},plugins:[wk]}))});
}
// tables
const row=(n,i,a)=>`<tr><td><i style="background:var(--${B[i]})"></i>${n}</td>${a.map(x=>`<td>${x}</td>`).join('')}</tr>`;
const chg=(a,b)=>{const p=pct(a,b);return p==null?'–':`<span class="${p>0?'up':p<0?'dn':'flat'}">${p>0?'+':''}${p.toFixed(1)}%</span>`};
document.getElementById('trtab').innerHTML=`<table><tr><th>Site</th><th>All</th><th>Canada</th></tr>${D.tr.sites.map((s,i)=>row(s,i,[chg(D.tr.sess.W[i],D.tr.sess.P[i]),chg(D.tr.ca.W[i],D.tr.ca.P[i])])).join('')}</table>`;
const I=D.impTot,og=D.org.W.reduce((a,b)=>a+b),ogp=D.org.P.reduce((a,b)=>a+b);
const r2=(n,a,b,c)=>`<tr><td>${n}</td><td>${n0(a)}</td><td>${n0(b)}</td><td>${chg(a,b)}</td>${c||''}</tr>`;
document.getElementById('imptab').innerHTML=`<table><tr><th>Source</th><th>This week</th><th>Prior week</th><th>Change</th></tr>
${r2('Meta ads (Facebook + Instagram)',I.metaW,I.metaP)}${r2('Google ads (YouTube, Search, Maps, Discover)',I.gW,I.gP)}${r2('<b>All paid</b>',I.metaW+I.gW,I.metaP+I.gP)}${r2('Organic search (Google, 4 sites)',og,ogp)}</table>`;
const EM=D.em,fW=EM.flow.W,fP=EM.flow.P,pW=EM.pop.W,pP=EM.pop.P,kl=EM.kl;
const pc=(a,b)=>b?(a/b*100).toFixed(2)+'%':'–';
const ec=EM.camp;
document.getElementById('ekpis').innerHTML=[['Campaign recipients',n0(ec.recipients),'<span class="d flat">1 campaign · '+ec.sent+'</span>'],['Open rate',ec.or.toFixed(1)+'%','<span class="d flat">'+ec.opens_u+' unique opens</span>'],['Click rate',ec.cr.toFixed(2)+'%','<span class="d flat">'+ec.clicks_u+' unique clicks</span>'],['Campaign orders',ec.orders,'<span class="d flat">$'+n0(ec.rev)+' USD · '+ec.unsub+' unsub</span>'],['Flow emails sent',n0(fW.recipients),dl(fW.recipients,fP.recipients)],['Popup signups',n0(pW.subs),dl(pW.subs,pP.subs)],['Popup submit rate',pc(pW.subs,pW.views),dl(pW.subs/pW.views,pP.subs/pP.views)],['Klaviyo sessions',n0(EM.klSess),dl(EM.klSess,EM.klSessP)]].map(x=>`<div class="kpi"><b>${x[0]}</b><span class="v">${x[1]}</span>${x[2]}</div>`).join('');
document.getElementById('emtab').innerHTML=`<table><tr><th>Program</th><th>Sent / views</th><th>Opens / signups</th><th>Clicks</th><th>Orders</th><th>Prior wk</th></tr>
<tr><td>Campaign · Black Friday Announcement</td><td>${n0(ec.recipients)}</td><td>${ec.opens_u} (${ec.or.toFixed(1)}%)</td><td>${ec.clicks_u} (${ec.cr.toFixed(2)}%)</td><td>${ec.orders} · $${n0(ec.rev)}</td><td>no campaign</td></tr>
<tr><td>Welcome flows · Email List</td><td>${n0(fW.recipients)}</td><td>${fW.opens_unique} (${pc(fW.opens_unique,fW.delivered)})</td><td>${fW.clicks_unique}</td><td>${fW.conversion_uniques}</td><td>${fP.recipients} sent · ${fP.opens_unique} opens</td></tr>
<tr><td>Popup · Email Popup</td><td>${n0(pW.views)} unique views</td><td>${n0(pW.subs)} (${pc(pW.subs,pW.views)})</td><td>–</td><td>–</td><td>${n0(pP.subs)} (${pc(pP.subs,pP.views)})</td></tr>
<tr><td>Klaviyo events · all email</td><td>${n0(kl['Received Email'].W)} received</td><td>${n0(kl['Opened Email'].W)} opens</td><td>${kl['Clicked Email'].W}</td><td>${kl['Placed Order'].W}</td><td>${n0(kl['Received Email'].P)} / ${n0(kl['Opened Email'].P)} / ${kl['Clicked Email'].P} / ${kl['Placed Order'].P}</td></tr></table>`;
const tb=(h,rows)=>`<table><tr>${h.map(x=>'<th>'+x+'</th>').join('')}</tr>${rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')}</table>`;
const sm=a=>a.reduce((x,y)=>x+y,0);
document.getElementById('akpis').innerHTML=[['Campaigns sent',3,'<span class="d flat">Envo 2 · Moonbike 1</span>'],['Campaign revenue','$'+n0(sm(KLA.crev)),'<span class="d flat">USD · Klaviyo-attributed</span>'],['Active flows',sm(KLA.flows),'<span class="d flat">eBike BC 4 · Envo 3</span>'],['Flow revenue','$11,121 + CA$17,057','<span class="d flat">USD + CAD</span>'],['Form submissions',sm(KLA.sub),'<span class="d flat">Moonbike 54%</span>'],['Best open rate','44.9%','<span class="d flat">Envo dealers · 0 clicks</span>'],['Top flow','CA$8,232','<span class="d flat">eBike BC abandoned cart</span>'],['Klaviyo accounts',5,'<span class="d flat">Veemo never sent a campaign</span>']].map(x=>`<div class="kpi"><b>${x[0]}</b><span class="v">${x[1]}</span>${x[2]}</div>`).join('');
document.getElementById('a_tab').innerHTML=tb(['Account','Campaigns sent','Campaign revenue','Active flows','Flow revenue','Form submissions'],KLA.acc.map((a,i)=>[a,KLA.camps[i],KLA.crev[i]?'$'+n0(KLA.crev[i]):'–',KLA.flows[i],KLA.frevT[i],KLA.sub[i]]));
document.getElementById('a_camp').innerHTML=tb(['Account','Campaign','Sent','Open rate (opens)','Click rate (clicks)','Revenue (orders)'],KLA.campRows);
document.getElementById('a_flow').innerHTML=tb(['Account','Flow','Revenue','Conversions (rate)','Deliveries (vs prior wk)','Recipients'],KLA.flowRows);
document.getElementById('a_form').innerHTML=tb(['Account','Form','Type','Submissions','Views','Submit rate','Revenue'],KLA.forms.map(x=>[x[0],x[1],x[2],x[3],x[4],x[5].toFixed(2)+'%',x[7]]));
document.getElementById('tkpis').innerHTML=[['Spend','$'+TKD.W.sp.toFixed(2),dl(TKD.W.sp,TKD.P.sp,true)],['Impressions',n0(TKD.W.imp),dl(TKD.W.imp,TKD.P.imp)],['Clicks',TKD.W.clk,dl(TKD.W.clk,TKD.P.clk)],['CTR',TKD.W.ctr.toFixed(2)+'%','<span class="d flat">vs '+TKD.P.ctr.toFixed(2)+'% prior</span>'],['CPC','$'+TKD.W.cpc.toFixed(2),dl(TKD.W.cpc,TKD.P.cpc,true)],['CPM','$'+TKD.W.cpm.toFixed(2),dl(TKD.W.cpm,TKD.P.cpm,true)],['Conversions',0,'<span class="d dn">0 on a conversion campaign</span>'],['Campaigns','1 active','<span class="d flat">+ 2 drafts</span>']].map(x=>`<div class="kpi"><b>${x[0]}</b><span class="v">${x[1]}</span>${x[2]}</div>`).join('');
document.getElementById('t_wow').innerHTML=`<table><tr><th>Metric</th><th>16–22 Nov</th><th>9–15 Nov</th><th>Change</th></tr>`+[['Spend','$'+TKD.W.sp.toFixed(2),'$'+TKD.P.sp.toFixed(2),chg(TKD.W.sp,TKD.P.sp)],['Impressions',n0(TKD.W.imp),n0(TKD.P.imp),chg(TKD.W.imp,TKD.P.imp)],['Clicks',TKD.W.clk,TKD.P.clk,chg(TKD.W.clk,TKD.P.clk)],['CTR',TKD.W.ctr.toFixed(2)+'%',TKD.P.ctr.toFixed(2)+'%','−0.06 pts'],['CPC','$'+TKD.W.cpc.toFixed(2),'$'+TKD.P.cpc.toFixed(2),chg(TKD.W.cpc,TKD.P.cpc)],['CPM','$'+TKD.W.cpm.toFixed(2),'$'+TKD.P.cpm.toFixed(2),chg(TKD.W.cpm,TKD.P.cpm)],['Conversions','0','–','–']].map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</table>';
document.getElementById('t_ads').innerHTML=`<table><tr><th>Ad ID</th><th>Spend</th><th>Impr.</th><th>Clicks</th><th>CTR</th><th>CPC</th><th>CPM</th></tr>`+TKD.ads.map(a=>`<tr><td>${a.id}</td><td>$${a.sp.toFixed(2)}</td><td>${n0(a.imp)}</td><td>${a.clk}</td><td>${a.ctr.toFixed(2)}%</td><td>$${a.cpc.toFixed(2)}</td><td>$${a.cpm.toFixed(2)}</td></tr>`).join('')+'</table>';
const ys=(y,a,b,kk)=>MB[y][kk].slice(a,b).reduce((x,z)=>x+z,0);
const ylab=MB.w26.map(w=>new Date(w+'T00:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric'}));
const yl25=MB.w26.map(w=>{const d=new Date(w+'T00:00:00');d.setDate(d.getDate()-364);return d.toLocaleDateString('en-CA',{month:'short',day:'numeric'})});
const yt=(a,b)=>({rev:[ys('y26',a,b,'rev'),ys('y25',a,b,'rev')],ord:[ys('y26',a,b,'orders'),ys('y25',a,b,'orders')],bk:[ys('y26',a,b,'units'),ys('y25',a,b,'units')],sp:[ys('y26',a,b,'spend'),ys('y25',a,b,'spend')],im:[ys('y26',a,b,'imp'),ys('y25',a,b,'imp')],dl:[ys('y26',a,b,'deals'),ys('y25',a,b,'deals')]});
const T8=yt(0,8);
document.getElementById('ykpis').innerHTML=[['Sales revenue',$(T8.rev[0]),dl(T8.rev[0],T8.rev[1])],['Orders',T8.ord[0],dl(T8.ord[0],T8.ord[1])],['Bikes sold',T8.bk[0],dl(T8.bk[0],T8.bk[1])],['Ad spend',$(T8.sp[0]),dl(T8.sp[0],T8.sp[1],true)],['Impressions',k(T8.im[0]),dl(T8.im[0],T8.im[1])],['CRM deals',T8.dl[0],dl(T8.dl[0],T8.dl[1])],['ROAS',(T8.rev[0]/T8.sp[0]).toFixed(2)+'x','<span class="d flat">vs '+(T8.rev[1]/T8.sp[1]).toFixed(2)+'x last year</span>'],['Spend per deal',$(T8.sp[0]/T8.dl[0]),'<span class="d flat">vs '+$(T8.sp[1]/T8.dl[1])+' last year</span>'],['Used Moonbikes (separate)',ys('y26',0,8,'used_units')+' sold · '+$(ys('y26',0,8,'used_rev')),'<span class="d flat">2025: '+ys('y25',0,8,'used_units')+' sold · '+$(ys('y25',0,8,'used_rev'))+'</span>']].map(x=>`<div class="kpi"><b>${x[0]}</b><span class="v">${x[1]}</span>${x[2]}</div>`).join('').replace(/vs prior wk/g,'vs 2025');
const mrow=(n,a,b)=>{const m=yt(a,b);const c=(x)=>`<td>${x}</td>`;return `<tr><td><b>${n}</b></td>${c($(m.rev[0])+' / '+$(m.rev[1])+' '+chg(m.rev[0],m.rev[1]))}${c(m.ord[0]+' / '+m.ord[1])}${c(m.bk[0]+' / '+m.bk[1])}${c($(m.sp[0])+' / '+$(m.sp[1])+' '+chg(m.sp[0],m.sp[1]))}${c(k(m.im[0])+' / '+k(m.im[1])+' '+chg(m.im[0],m.im[1]))}${c(m.dl[0]+' / '+m.dl[1]+' '+chg(m.dl[0],m.dl[1]))}${c((m.rev[0]/m.sp[0]).toFixed(2)+'x / '+(m.rev[1]/m.sp[1]).toFixed(2)+'x')}</tr>`};
document.getElementById('y_mon').innerHTML=`<table><tr><th>2026 / 2025</th><th>Revenue</th><th>Orders</th><th>Bikes</th><th>Ad spend</th><th>Impressions</th><th>CRM deals</th><th>ROAS</th></tr>${mrow('October (4 wks)',1,5)}${mrow('November so far (3 wks)',5,8)}${mrow('Sep 28 – Nov 22 (8 wks)',0,8)}</table>`;
document.getElementById('y_tab').innerHTML=`<table><tr><th>Week of (2026 / 2025)</th><th>Revenue 26</th><th>Revenue 25</th><th>Orders</th><th>Bikes</th><th>Spend 26</th><th>Spend 25</th><th>Impr. 26</th><th>Impr. 25</th><th>Deals</th><th>ROAS</th></tr>${ylab.map((w,i)=>`<tr><td>${w} / ${yl25[i]}</td><td>${$(MB.y26.rev[i])}</td><td>${$(MB.y25.rev[i])}</td><td>${MB.y26.orders[i]} / ${MB.y25.orders[i]}</td><td>${MB.y26.units[i]} / ${MB.y25.units[i]}</td><td>${$(MB.y26.spend[i])}</td><td>${$(MB.y25.spend[i])}</td><td>${n0(MB.y26.imp[i])}</td><td>${n0(MB.y25.imp[i])}</td><td>${MB.y26.deals[i]} / ${MB.y25.deals[i]}</td><td>${(MB.y26.rev[i]/MB.y26.spend[i]).toFixed(2)}x / ${(MB.y25.rev[i]/MB.y25.spend[i]).toFixed(2)}x</td></tr>`).join('')}</table>`;
document.getElementById('foot').innerHTML=`<div><b>Sources:</b> Shopify Admin API (4 stores) · Google Ads API · Meta Marketing API · GA4 (4 properties) · Google Search Console via Zoho Analytics · Zoho CRM Deals. Weekly snapshot copied from the Weekly Marketing Report; not refreshed by the hourly Zoho update.</div>
<div><b>B2C</b> = paid Shopify orders, net of discounts, before tax and shipping; includes staff-created draft orders (in-store/phone). Excluded as B2B: ${D.exclW?$(D.exclW):'$0'} CAD dealer orders on envodrive.com (4 orders). USD → CAD at 1.37. Cancelled/refunded orders removed.</div>
<div><b>ROAS</b> = Shopify B2C revenue ÷ ad spend; spend assigned to brand by campaign name; Veemo had no ad spend. CTR: Google = clicks ÷ impressions, Meta = link clicks ÷ impressions. Product = from campaign/ad set name.</div>
<div><b>Moonbike year-over-year:</b> sales, orders and bikes exclude used Moonbikes (product title “used”: 1 sold, order #1171 on 14 Nov 2026, US$4,500 ≈ CA$6,165; none in 2025), shown separately in the last tile; ROAS uses the same new-only revenue. weeks are Mon–Sun, aligned 364 days apart (2026 week of 5 Oct vs 2025 week of 6 Oct). Sales = Moonbike Shopify store, B2C definition (paid orders net of discounts, before tax/shipping, staff-created orders included, USD→CAD at 1.37 for both years). Spend and impressions = Meta (incl. the archived 2025 Main Conversion campaign) + Google Ads campaigns with “Moonbike” in the name; TikTok/LinkedIn excluded; Meta USD→CAD at 1.37. Deals = Zoho CRM deals created in the MoonBikes pipeline; the pipeline had no deals before mid-Oct 2025 (0 for the first two 2025 weeks is a data gap, not zero demand). The Sep 28 week straddles September/October; November has 3 full weeks so far.</div>
<div><b>TikTok:</b> Moonbike TikTok Ads Manager (Nov 16–22 report, CAD; ENVO Drive account not in this report). One active campaign (Website conversion), 3 ads in one ad group sharing the same name, so shown by ad ID. 0 conversions suggests the TikTok pixel/conversion event may not be firing. Not included in the spend, impressions or ROAS totals above.</div>
<div><b>All Klaviyo accounts:</b> from the Klaviyo Weekly Activity Report (Nov 16–22, pulled from the Klaviyo web app); revenue = Klaviyo-attributed Placed Order value, eBike BC in CAD, others in USD, not converted. Envo’s two forms both show $121 (likely one order counted twice). Views marked ~ are rounded by Klaviyo. Draft forms excluded.</div>
<div><b>Email:</b> Klaviyo (Moonbike account) · campaign orders are Klaviyo-attributed (USD); flow figures are Klaviyo-reported (orders in USD); Apple Mail privacy can inflate opens. Popup = Klaviyo form report (Mon–Sun, unique views). Popup submits (251) and Klaviyo “Subscribed to Email Marketing” events (232) move together but do not match 1:1 — not investigated.</div>
<div><b>Traffic:</b> GA4 includes bot traffic (Singapore, Hong Kong, China); Canada and engaged-session views are the cleaner read. <b>Not available this week:</b> TikTok and LinkedIn Ads, popup signups for ENVO / EbikeBC / Modular-EV / Veemo (supplied manually in earlier weeks), organic social impressions (no Page access), Klaviyo for ENVO / EbikeBC / Veemo (only the Moonbike account is connected).</div>`;
render();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
