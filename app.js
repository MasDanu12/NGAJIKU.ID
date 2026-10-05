const KEY='tpq_data_v1';
const ASPEK_LABEL={makhraj:"Makhraj",kelancaran:"Kelancaran",tajwid:"Tajwid",sifat_huruf:"Sifat Huruf"};
const NILAI_PILIHAN=[{t:"Mumtaz",v:90},{t:"Jayyid Jiddan",v:75},{t:"Jayyid",v:60},{t:"Maqbul",v:45}];

const DEFAULT=()=>({
  lembaga:"TPQ Tracker",
  tahapan:{
    faturrahman:{nama:"Al Bayan - Faturrahman",total:84,aspek:["makhraj","kelancaran"],
      bab:[{nama:"Bab 1",awal:1,akhir:15},{nama:"Bab 2",awal:16,akhir:30},{nama:"Bab 3",awal:31,akhir:50},{nama:"Bab 4",awal:51,akhir:84}]},
    albayan_lanjutan:{nama:"Al Bayan Lanjutan",total:84,aspek:["makhraj","tajwid","kelancaran"],bab:[{nama:"Bab 1",awal:1,akhir:84}]},
    quran:{nama:"Al-Qur'an",total:null,aspek:["makhraj","tajwid","kelancaran"]},
    makhraj_sifat:{nama:"Makhraj & Sifat Huruf",total:null,aspek:["makhraj","sifat_huruf"]}
  },
  materi:{quran:["An-Nas","Al-Falaq","Al-Ikhlas"],doa:[],hadits:[]},
  murid:[],
  absen:{}
});

function load(){
  try{const s=JSON.parse(localStorage.getItem(KEY)); if(s&&s.murid&&s.tahapan) return s;}catch(e){}
  return DEFAULT();
}
let DB=load();
function simpan(){localStorage.setItem(KEY,JSON.stringify(DB));}

let kelasAbsen="banin", chartInstance=null, muridAktif="", pilihan={};

// ---------- Utilitas ----------
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hariIni=()=>new Date().toLocaleDateString('sv-SE');
const cariMurid=id=>DB.murid.find(x=>x.id===id);
function toast(msg){
  const d=document.createElement('div');
  d.textContent=msg;
  d.className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-slate-800 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50";
  document.body.appendChild(d);
  setTimeout(()=>d.remove(),1800);
}
function labelNilai(n){
  if(n>=85) return {t:"Mumtaz",c:"text-emerald-600"};
  if(n>=70) return {t:"Jayyid Jiddan",c:"text-sky-600"};
  if(n>=56) return {t:"Jayyid",c:"text-yellow-600"};
  if(n>=40) return {t:"Maqbul",c:"text-orange-500"};
  return {t:"Perlu Perbaikan",c:"text-red-500"};
}
const warnaNilai=v=>v<56?"#ef4444":v<70?"#f97316":"#10b981";

// rata-rata 3 penilaian terakhir per aspek
function rataNilai(m){
  const map={};
  m.penilaian.slice(-3).forEach(p=>Object.entries(p.nilai).forEach(([k,v])=>{(map[k]=map[k]||[]).push(v);}));
  const out={};
  Object.entries(map).forEach(([k,a])=>out[k]=Math.round(a.reduce((x,y)=>x+y,0)/a.length));
  return out;
}
function perluPerhatian(m){
  if(!m.penilaian.length) return false;
  const lemah=Object.values(rataNilai(m)).some(v=>v<56);
  const ulang2=m.penilaian.length>=2 && m.penilaian.slice(-2).every(p=>p.status==="ulang");
  return lemah||ulang2;
}
const statusAbsen=id=>((DB.absen[hariIni()]||{})[id])||"H";

// ---------- Navigasi ----------
const NAV=[
  ["dashboard","Dashboard",'<rect x="2" y="2" width="7" height="7"/><rect x="11" y="2" width="7" height="7"/><rect x="2" y="11" width="7" height="7"/><rect x="11" y="11" width="7" height="7"/>'],
  ["absensi","Absensi",'<rect x="2" y="3" width="16" height="15" rx="2"/><path d="M6 1v4M14 1v4M2 8h16"/>'],
  ["murid","Murid",'<circle cx="10" cy="6" r="3"/><path d="M3 18c0-4 3-6 7-6s7 2 7 6"/>'],
  ["hafalan","Hafalan",'<path d="M2 4h7v14H2zM11 4h7v14h-7z"/>'],
  ["admin","Admin",'<circle cx="10" cy="10" r="3"/><path d="M10 1v3M10 16v3M3 10H1M19 10h-2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/>']
];
document.getElementById('nav').innerHTML=NAV.map(([id,t,svg],i)=>`
  <button onclick="goto('${id}')" class="navBtn ${i===0?'nav-active':''} flex flex-col items-center text-[11px] gap-1 px-1" data-page="${id}">
    <svg width="20" height="20" fill="none" stroke="${i===0?'#047857':'#94a3b8'}" stroke-width="2">${svg}</svg>${t}
  </button>`).join('');

function goto(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));

document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.navBtn').forEach(b=>{
    const aktif=b.dataset.page===page;
    b.classList.toggle('nav-active',aktif);
    b.querySelector('svg').setAttribute('stroke',aktif?'#047857':'#94a3b8');
  });
  if(page==="dashboard") renderDashboard();
  if(page==="absensi") renderAbsensi();
  if(page==="murid"){ renderPilihMurid(); tampilkanProfil(); }
  if(page==="hafalan"){ renderPilihHafalan(); tampilkanHafalan(); }
  if(page==="admin"){ tampilkanLembaga(); tampilkanBab(); tampilkanMateri(); }
  window.scrollTo(0,0);
}

// ---------- Lembaga ----------
function applyLembaga(){
  document.getElementById('namaLembaga').textContent=DB.lembaga;
  document.title=DB.lembaga;
}
function tampilkanLembaga(){ document.getElementById('inputLembaga').value=DB.lembaga; }
function simpanLembaga(){
  const v=document.getElementById('inputLembaga').value.trim();
  if(!v){ toast("Nama lembaga tidak boleh kosong"); return; }
  DB.lembaga=v; simpan(); applyLembaga(); toast("Nama lembaga disimpan");
}

// ---------- Dashboard ----------
function renderDashboard(){
  const total=DB.murid.length;
  const hadir=DB.murid.filter(m=>statusAbsen(m.id)==="H").length;
  document.getElementById('statTotal').textContent=total;
  document.getElementById('statPerhatian').textContent=DB.murid.filter(perluPerhatian).length;
  document.getElementById('statHadir').textContent=(total?Math.round(hadir/total*100):0)+"%";

  const lp=document.getElementById('listPerhatian');
  lp.innerHTML=DB.murid.filter(perluPerhatian).map(m=>{
    const lemah=Object.entries(rataNilai(m)).sort((a,b)=>a[1]-b[1])[0];
    return `<div class="bg-red-50 border border-red-200 rounded-xl p-3 flex justify-between items-center">
      <div><p class="font-semibold text-slate-700 text-sm">${esc(m.nama)}</p>
      <p class="text-xs text-red-600">${lemah?esc(ASPEK_LABEL[lemah[0]])+" rendah ("+lemah[1]+")":"Perlu evaluasi"}</p></div>
      <span class="text-xs bg-red-200 text-red-700 px-2 py-1 rounded-full">${esc(m.kelas)}</span></div>`;
  }).join("") || `<p class="text-sm text-slate-400">Tidak ada murid bermasalah 🎉</p>`;

  document.getElementById('listMuridDashboard').innerHTML=DB.murid.map(m=>{
    const v=Object.values(rataNilai(m));
    const rata=v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):null;
    const lb=rata===null?{t:"Belum dinilai",c:"text-slate-400"}:labelNilai(rata);
    return `<div onclick="bukaProfil('${m.id}')" class="bg-white rounded-xl p-3 shadow flex justify-between items-center cursor-pointer">
      <div><p class="font-semibold text-slate-700 text-sm">${esc(m.nama)}</p>
      <p class="text-xs text-slate-400">${esc((DB.tahapan[m.tahapan]||{}).nama||"-")}</p></div>
      <div class="text-right"><p class="font-bold ${lb.c}">${rata===null?"-":rata}</p>
      <p class="text-[10px] text-slate-400">${lb.t}</p></div></div>`;
  }).join("") || `<p class="text-sm text-slate-400">Belum ada murid. Tambah di menu Murid.</p>`;
}
function bukaProfil(id){
  muridAktif=id; goto('murid');
  document.getElementById('pilihMurid').value=id;
  tampilkanProfil();
}

// ---------- Absensi ----------
function filterAbsen(k){ kelasAbsen=k; renderAbsensi(); }
function renderAbsensi(){
  document.getElementById('tanggalHariIni').textContent=
    new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('tabAbsen').innerHTML=["banin","banat","privat"].map(k=>`
    <button onclick="filterAbsen('${k}')" class="px-4 py-1.5 rounded-full text-sm ${k===kelasAbsen?'bg-emerald-700 text-white':'bg-white border'}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('');
  document.getElementById('listAbsensi').innerHTML=DB.murid.filter(m=>m.kelas===kelasAbsen).map(m=>{

const s=statusAbsen(m.id);
    const w=s==="H"?"bg-emerald-100 text-emerald-700":s==="I"?"bg-sky-100 text-sky-700":s==="S"?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700";
    return `<div onclick="gantiAbsen('${m.id}')" class="bg-white rounded-xl p-3 shadow flex justify-between items-center cursor-pointer">
      <p class="text-sm font-medium text-slate-700">${esc(m.nama)}</p>
      <span class="px-3 py-1 rounded-full text-xs font-semibold ${w}">${s}</span></div>`;
  }).join("") || `<p class="text-sm text-slate-400">Belum ada murid di kelas ini.</p>`;
}
function gantiAbsen(id){
  const t=hariIni(), u=["H","I","S","A"];
  DB.absen[t]=DB.absen[t]||{};
  DB.absen[t][id]=u[(u.indexOf(statusAbsen(id))+1)%4];
  simpan(); renderAbsensi();
}

// ---------- Murid ----------
function isiTahap(){
  document.getElementById('mTahap').innerHTML=Object.entries(DB.tahapan).map(([k,t])=>`<option value="${k}">${esc(t.nama)}</option>`).join('');
}
function renderPilihMurid(){
  document.getElementById('pilihMurid').innerHTML=`<option value="">-- Pilih murid --</option>`+
    DB.murid.map(m=>`<option value="${m.id}">${esc(m.nama)}</option>`).join('');
  document.getElementById('pilihMurid').value=cariMurid(muridAktif)?muridAktif:"";
}
function tambahMurid(){
  const nama=document.getElementById('mNama').value.trim();
  if(!nama){ toast("Isi nama murid"); return; }
  DB.murid.push({id:"m"+Date.now(),nama,kelas:document.getElementById('mKelas').value,
    tahapan:document.getElementById('mTahap').value,halaman:0,penilaian:[],hafalan:{quran:[],doa:[],hadits:[]}});
  document.getElementById('mNama').value="";
  simpan(); renderPilihMurid(); toast("Murid ditambahkan");
}
function hapusMurid(){
  const m=cariMurid(muridAktif); if(!m) return;
  if(!confirm("Hapus "+m.nama+" beserta seluruh nilainya?")) return;
  DB.murid=DB.murid.filter(x=>x.id!==m.id);
  muridAktif=""; simpan(); renderPilihMurid(); tampilkanProfil(); toast("Murid dihapus");
}
function pilihNilai(a,v){ pilihan[a]=v; renderInputAspek(); }
function renderInputAspek(){
  const m=cariMurid(muridAktif); if(!m) return;
  document.getElementById('inputAspek').innerHTML=DB.tahapan[m.tahapan].aspek.map(a=>`
    <div><p class="text-xs text-slate-500 mb-1">${ASPEK_LABEL[a]}</p>
    <div class="grid grid-cols-4 gap-1">${NILAI_PILIHAN.map(n=>`
      <button onclick="pilihNilai('${a}',${n.v})" class="py-2 rounded-lg border text-[11px] leading-tight ${pilihan[a]===n.v?'bg-emerald-700 text-white border-emerald-700':'bg-white text-slate-600'}">${n.t}</button>`).join('')}
    </div></div>`).join('');
}
function tampilkanProfil(){
  const id=document.getElementById('pilihMurid').value;
  const box=document.getElementById('profilBox');
  if(id!==muridAktif) pilihan={};
  muridAktif=id;
  const m=cariMurid(id);
  if(!m){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const t=DB.tahapan[m.tahapan];
  document.getElementById('avatarMurid').textContent=m.nama.charAt(0);
  document.getElementById('namaProfil').textContent=m.nama;
  document.getElementById('infoProfil').textContent="Kelas "+m.kelas;
  document.getElementById('tahapProfil').textContent=t.nama;
  let pos="Per surat/juz";
  if(t.total){
    const bab=(t.bab||[]).find(b=>m.halaman>=b.awal&&m.halaman<=b.akhir);
    pos=`Hal. ${m.halaman} / ${t.total}`+(bab?` • ${bab.nama}`:"");
  }
  document.getElementById('posisiProfil').textContent=pos;
  document.getElementById('progressBar').style.width=t.total?Math.min(100,m.halaman/t.total*100)+"%":"0%";
  renderInputAspek();

  const r=rataNilai(m), keys=Object.keys(r);
  if(chartInstance){ chartInstance.destroy(); chartInstance=null; }
  if(keys.length && typeof Chart!=="undefined"){
    chartInstance=new Chart(document.getElementById('chartNilai'),{
      type:'bar',

data:{labels:keys.map(k=>ASPEK_LABEL[k]),datasets:[{data:keys.map(k=>r[k]),backgroundColor:keys.map(k=>warnaNilai(r[k])),borderRadius:6}]},
      options:{scales:{y:{min:0,max:100}},plugins:{legend:{display:false}}}
    });
  }
  document.getElementById('labelKekurangan').innerHTML=keys.map(k=>{
    const v=r[k], lb=labelNilai(v), tanda=v<56?"🔴":v<70?"🟠":"🟢";
    return `<p class="flex justify-between"><span>${tanda} ${ASPEK_LABEL[k]}</span><span class="${lb.c} font-semibold">${v} (${lb.t})</span></p>`;
  }).join("") || `<p class="text-slate-400">Belum ada penilaian.</p>`;

  document.getElementById('riwayat').innerHTML=m.penilaian.map((p,i)=>({p,i})).reverse().map(({p,i})=>`
    <div class="border-l-2 border-emerald-500 pl-3">
      <div class="flex justify-between"><p class="text-xs text-slate-400">${esc(p.tgl)}${p.halaman?" • Hal. "+p.halaman:""}</p>
      <button onclick="hapusPenilaian(${i})" class="text-red-500 text-xs">Hapus</button></div>
      <p class="font-medium text-slate-700">${Object.entries(p.nilai).map(([k,v])=>ASPEK_LABEL[k]+": "+v).join(", ")}</p>
      <p class="text-xs text-slate-500">${p.status==="ulang"?"🔁 Ulang":"✅ Lanjut"}${p.catatan?" — "+esc(p.catatan):""}</p>
    </div>`).join("") || `<p class="text-slate-400">Belum ada riwayat.</p>`;
}
function simpanPenilaian(){
  const m=cariMurid(muridAktif);
  if(!m){ toast("Pilih murid dulu"); return; }
  const t=DB.tahapan[m.tahapan];
  if(t.aspek.some(a=>!pilihan[a])){ toast("Pilih nilai untuk semua aspek"); return; }
  const nilai={}; t.aspek.forEach(a=>nilai[a]=pilihan[a]);
  const hal=parseInt(document.getElementById('inputHalaman').value)||m.halaman;
  m.penilaian.push({tgl:hariIni(),halaman:hal,nilai,
    status:document.getElementById('inputStatus').value,
    catatan:document.getElementById('inputCatatan').value.trim()});
  m.halaman=hal;
  pilihan={};
  document.getElementById('inputHalaman').value="";
  document.getElementById('inputCatatan').value="";
  document.getElementById('inputStatus').value="lanjut";
  simpan(); tampilkanProfil(); toast("Penilaian tersimpan");
}
function hapusPenilaian(i){
  const m=cariMurid(muridAktif); if(!m) return;
  if(!confirm("Hapus penilaian ini?")) return;
  m.penilaian.splice(i,1); simpan(); tampilkanProfil();
}

// ---------- Hafalan ----------
function renderPilihHafalan(){
  const sel=document.getElementById('pilihMuridHafalan'), cur=sel.value;
  sel.innerHTML=`<option value="">-- Pilih murid --</option>`+DB.murid.map(m=>`<option value="${m.id}">${esc(m.nama)}</option>`).join('');
  sel.value=cariMurid(cur)?cur:"";
}
function tampilkanHafalan(){
  const id=document.getElementById('pilihMuridHafalan').value;
  const box=document.getElementById('hafalanBox');
  const m=cariMurid(id);
  if(!m){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  renderListHafalan(m,'quran','listQuran');
  renderListHafalan(m,'doa','listDoa');
  renderListHafalan(m,'hadits','listHadits');
}
function renderListHafalan(m,jenis,elId){
  const wrap=document.getElementById(elId), daftar=DB.materi[jenis];
  if(!daftar.length){ wrap.innerHTML=`<p class="text-xs text-slate-400">Belum ada materi. Tambah di menu Admin.</p>`; return; }
  wrap.innerHTML=daftar.map((item,i)=>{
    const sudah=m.hafalan[jenis].includes(item);
    return `<label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" ${sudah?"checked":""} onchange="toggleHafalan('${m.id}','${jenis}',${i})" class="accent-emerald-700">
      <span class="${sudah?'text-emerald-700 font-medium':''}">${esc(item)}</span></label>`;
  }).join("");
}
function toggleHafalan(id,jenis,idx){
  const m=cariMurid(id), item=DB.materi[jenis][idx];
  const arr=m.hafalan[jenis], i=arr.indexOf(item);
  if(i>=0) arr.splice(i,1); else arr.push(item);
  simpan(); tampilkanHafalan();
}

// ---------- Admin: Bab ----------
function tampilkanBab(){
  const kitab=