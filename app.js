import {firebaseConfig,cloudinary} from "./firebase-config.js";
import {initializeApp} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {getFirestore,doc,collection,onSnapshot,setDoc,updateDoc,deleteDoc,query,orderBy} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb);
function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]/g,"")}
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("on");setTimeout(function(){e.classList.remove("on")},1700)}
function stat(t){$("stat").textContent=t}
function copy(t){
  function fb(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");toast("Copied")}catch(e){toast("Copy failed")}a.remove()}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast("Copied")},fb)}else fb()
}
var M=["Rose gold","Sterling silver","White gold","Yellow gold"];
function mkFields(){return [
{id:"title",label:"Title",type:"text",max:140,sec:"Item details",hint:"Max 140 characters. Main keywords first."},
{id:"desc",label:"Description",type:"area",footer:1,sec:"Item details",hint:"The standard footer (bottom of page) is added when you copy."},
{id:"tags",label:"Tags",type:"chips",max:13,each:20,sec:"Attributes",lib:[],def:[],hint:"Max 13 tags, each up to 20 characters. Click a tag to copy just that tag."},
{id:"materials",label:"Materials",type:"chips",max:13,each:45,sec:"Attributes",lib:M.slice(),def:M.slice()},
{id:"solidity",label:"Gold solidity",type:"chips",max:5,each:45,sec:"Attributes",lib:["Solid gold"],def:["Solid gold"]},
{id:"purity",label:"Gold purity",type:"chips",max:5,each:45,sec:"Attributes",lib:["10k","14k","18k"],def:["10k","14k","18k"]},
{id:"price",label:"Price",type:"text",sec:"Price and inventory"},
{id:"sku",label:"SKU",type:"text",max:32,sec:"Price and inventory"}
]}
var GEMS=["Moissanite","Lab grown"];
var MATS=["925 Sterling Silver"].concat(["10K","14K","18K"].reduce(function(a,p){return a.concat(["Yellow","White","Rose"].map(function(c){return p+" "+c+" Gold"}))},[]));
var PROCS=["Made to order: 8-10 days"];
var CFG={fields:mkFields(),footer:"",gems:GEMS.slice(),mats:MATS.slice(),procs:PROCS.slice()};
var L={},ORDER=[],IM=[],cur=null,edit=false,vedit=false,seeded=false,madeFirst=false,pendRender=false,pend={},tm={},busy={},unsubs=[];
function setLocal(l,path,v){var p=path.split("."),o=l;for(var i=0;i<p.length-1;i++){if(typeof o[p[i]]!=="object"||o[p[i]]===null)o[p[i]]={};o=o[p[i]]}o[p[p.length-1]]=v}
function val(f){
  var v=L[cur]&&L[cur].vals&&L[cur].vals[f.id];
  if(f.type==="chips")return Array.isArray(v)?v:(typeof v==="string"&&v?v.split(",").map(function(x){return x.trim()}).filter(Boolean):[]);
  return v||""
}
function vget(k,p){var v=L[cur]&&L[cur].vars&&L[cur].vars[k];return v?v[p]:undefined}
function lname(id){var l=L[id],v=l&&l.vals||{};return {t:(v.title||"").trim()||"Untitled listing",s:v.sku||""}}
function renderList(){
  $("list").innerHTML=ORDER.map(function(id){var n=lname(id);return '<button class="li'+(id===cur?' on':'')+'" data-go="'+id+'">'+esc(n.t)+(n.s?'<small>'+esc(n.s)+'</small>':'')+'</button>'}).join("")
}
function counter(f,v){
  if(f.type==="chips"){var long=v.filter(function(x){return f.each&&x.length>f.each}).length;return {t:v.length+(f.max?"/"+f.max:""),bad:(f.max&&v.length>f.max)||long>0}}
  if(f.type==="text"&&f.max)return {t:v.length+"/"+f.max,bad:v.length>f.max};
  return {t:v.length?v.length+" chars":"",bad:false}
}
function setCnt(f){var c=counter(f,val(f)),el=$("c_"+f.id);if(el){el.textContent=c.t;el.className="cnt"+(c.bad?" bad":"")}}
function chipsInner(f,i){
  var v=val(f);
  var h='<div class="chips">'+v.map(function(t,k){return '<span class="chip"><button data-cc="'+i+':'+k+'" title="Click to copy">'+esc(t)+'</button><button class="cx" data-cx="'+i+':'+k+'" aria-label="Remove">&times;</button></span>'}).join("")+'</div>';
  h+='<div class="row"><input type="text" id="ci_'+f.id+'" data-ci="'+i+'" placeholder="Type and press Enter (commas add several)"><button class="b s" data-cadd="'+i+'">Add</button></div>';
  var lib=f.lib||[];
  if(lib.length)h+='<div class="lib"><span class="hint">Saved options, click to add or remove:</span><div class="chips">'+lib.map(function(t,k){var on=v.some(function(x){return x.toLowerCase()===t.toLowerCase()});return '<span class="chip lb'+(on?' on':'')+'"><button data-lib="'+i+':'+k+'">'+esc(t)+'</button><button class="cx" data-lx="'+i+':'+k+'" aria-label="Delete saved option">&times;</button></span>'}).join("")+'</div></div>';
  h+='<div class="row"><button class="b s" data-cdef="'+i+'">Save current as default for new listings</button></div>';
  return h
}
function mediaList(t){return IM.filter(function(x){return x.lid===cur&&(x.type||"image")===t})}
function procOpts(sel){var p=sel||CFG.procs[0];return CFG.procs.map(function(x){return '<option value="'+esc(x)+'"'+(x===p?" selected":"")+'>'+esc(x)+'</option>'}).join("")+(sel&&CFG.procs.indexOf(sel)<0?'<option value="'+esc(sel)+'" selected>'+esc(sel)+'</option>':"")}
function rows(){var r=[];CFG.gems.forEach(function(g){CFG.mats.forEach(function(m){r.push({g:g,m:m,k:slug(g)+"_"+slug(m)})})});return r}
function varsInner(){
  var h='<div class="fh"><h2>Variations</h2><button class="b s" data-a="vedit">'+(vedit?"Done":"Edit options")+'</button></div><p class="hint">Gemstone and material combinations. Options you add or remove here are saved for every listing. Prices and visibility are saved per listing.</p>';
  if(vedit){[["gems","Gemstones"],["mats","Materials"],["procs","Processing profiles"]].forEach(function(n){
    h+='<div class="f"><div class="fh"><label>'+n[1]+'</label></div><div class="chips">'+CFG[n[0]].map(function(t,k){return '<span class="chip">'+esc(t)+'<button class="cx" data-vx="'+n[0]+':'+k+'" aria-label="Remove">&times;</button></span>'}).join("")+'</div><div class="row"><input type="text" id="vi_'+n[0]+'" data-vi="'+n[0]+'" placeholder="Add new and press Enter"><button class="b s" data-vadd="'+n[0]+'">Add</button></div></div>'})}
  var opts='<option value="all">All rows</option>'+CFG.gems.map(function(g){return '<option value="g:'+esc(g)+'">Gemstone: '+esc(g)+'</option>'}).join("")+CFG.mats.map(function(m){return '<option value="m:'+esc(m)+'">Material: '+esc(m)+'</option>'}).join("");
  h+='<div class="row" style="margin-top:12px"><input type="text" id="bp" placeholder="Price" inputmode="decimal" style="max-width:110px;flex:none"><select id="bt" style="width:auto">'+opts+'</select><button class="b s" data-a="bulkp">Set price</button></div>';
  h+='<div class="row"><select id="bpr" style="width:auto">'+procOpts()+'</select><button class="b s" data-a="bulkproc">Set processing for all rows</button><button class="b s" data-a="copyprices">Copy all prices</button></div>';
  h+='<div class="tw"><table class="vt"><thead><tr><th>Gemstone</th><th>Material</th><th>Price (US$)</th><th>Processing</th><th>Visible</th><th></th></tr></thead><tbody>';
  rows().forEach(function(r){
    var p=vget(r.k,"price")||"",pr=vget(r.k,"proc")||"",vis=vget(r.k,"vis")!==false;
    h+='<tr><td>'+esc(r.g)+'</td><td>'+esc(r.m)+'</td><td><input type="text" inputmode="decimal" id="vp_'+r.k+'" data-vp="'+r.k+'" value="'+esc(p)+'"></td><td><select id="vs_'+r.k+'" data-vs="'+r.k+'">'+procOpts(pr)+'</select></td><td><input type="checkbox" id="vv_'+r.k+'" data-vv="'+r.k+'"'+(vis?" checked":"")+' aria-label="Visible"></td><td><button class="b s" data-vc="'+r.k+'">Copy price</button></td></tr>'
  });
  return h+'</tbody></table></div>'
}
function renderMain(){
  pendRender=false;
  if(!cur){$("main").innerHTML="";return}
  var h='<div class="bar"><button class="b s" data-a="dup">Duplicate listing</button><button class="b s" data-a="del">Delete listing</button><button class="b s" data-a="edit">'+(edit?"Done editing fields":"Edit fields")+'</button><button class="b s" data-a="theme">Light / dark</button></div>';
  h+='<div class="card"><div class="fh"><h2>Photos and video</h2><span class="cnt" id="ic"></span></div><input type="file" id="files" accept="image/*,video/*" multiple><p class="hint">Files are stored exactly as uploaded (no compression). Download gives the original. Etsy takes up to 20 photos and 2 videos; the first photo is the featured one.</p><div class="imgs" id="imgs"></div></div>';
  var last=null,open=false;
  CFG.fields.forEach(function(f,i){
    if(f.sec!==last){if(open)h+='</div>';h+='<div class="card"><h2>'+esc(f.sec||"More details")+'</h2>';open=true;last=f.sec}
    h+='<div class="f">';
    if(edit)h+='<div class="ed"><input type="text" data-fl="'+i+'" value="'+esc(f.label)+'" aria-label="Field name"><select data-ft="'+i+'"><option value="text"'+(f.type==="text"?" selected":"")+'>Short text</option><option value="area"'+(f.type==="area"?" selected":"")+'>Long text</option><option value="chips"'+(f.type==="chips"?" selected":"")+'>Chips (tags style)</option></select><button class="b s" data-up="'+i+'">Up</button><button class="b s" data-dn="'+i+'">Down</button><button class="b s" data-rm="'+i+'">Remove</button></div>';
    var v=val(f),c=counter(f,v);
    h+='<div class="fh"><label for="f_'+f.id+'">'+esc(f.label)+'</label><span class="cnt'+(c.bad?' bad':'')+'" id="c_'+f.id+'">'+esc(c.t)+'</span><button class="b s" data-cp="'+i+'">Copy'+(f.type==="chips"?" all":"")+'</button></div>';
    if(f.type==="chips")h+='<div id="cw_'+f.id+'">'+chipsInner(f,i)+'</div>';
    else h+=f.type==="area"?'<textarea id="f_'+f.id+'" data-v="'+i+'">'+esc(v)+'</textarea>':'<input type="text" id="f_'+f.id+'" data-v="'+i+'" value="'+esc(v)+'">';
    if(f.hint)h+='<p class="hint">'+esc(f.hint)+'</p>';
    h+='</div>'
  });
  if(open)h+='</div>';
  if(edit)h+='<button class="b p" data-a="addf" style="margin-bottom:12px">Add field</button>';
  h+='<div class="card" id="vwrap">'+varsInner()+'</div>';
  h+='<div class="card"><h2>Standard description footer</h2><textarea id="footer" style="min-height:70px;margin-top:8px" placeholder="Shipping, care, returns. Added to every description when copied.">'+esc(CFG.footer)+'</textarea></div>';
  $("main").innerHTML=h;
  renderImgs()
}
function renderMainSafe(){
  var a=document.activeElement;
  if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.tagName==="SELECT")&&$("main").contains(a)){pendRender=true;return}
  renderMain()
}
function updateValues(){
  CFG.fields.forEach(function(f,i){
    if(f.type==="chips"){var w=$("cw_"+f.id);if(w&&!w.contains(document.activeElement))w.innerHTML=chipsInner(f,i);setCnt(f);return}
    var el=$("f_"+f.id);if(!el)return;
    if(el!==document.activeElement){var v=val(f);if(el.value!==v)el.value=v}
    setCnt(f)
  });
  rows().forEach(function(r){
    var p=$("vp_"+r.k);if(p&&p!==document.activeElement){var v=vget(r.k,"price")||"";if(p.value!==v)p.value=v}
    var s=$("vs_"+r.k);if(s&&s!==document.activeElement){var pr=vget(r.k,"proc")||CFG.procs[0];if(s.value!==pr)s.innerHTML=procOpts(vget(r.k,"proc")||"")}
    var c=$("vv_"+r.k);if(c&&c!==document.activeElement)c.checked=vget(r.k,"vis")!==false
  })
}
function tile(x,n){
  var v=x.type==="video";
  return '<div class="im">'+(v?'<video src="'+esc(x.url)+'" preload="metadata" muted controls playsinline></video>':'<img loading="lazy" src="'+esc(x.url.replace('/upload/','/upload/w_300,h_300,c_fill,q_auto/'))+'" alt="">')+'<div title="'+esc(x.name)+'">'+n+'. '+esc(x.name)+(!v&&n===1?' <span class="feat">Featured</span>':'')+'</div><div>'+(x.size/1048576).toFixed(2)+' MB</div><div class="r"><button class="b s" data-dl="'+x.id+'">Download</button><button class="b s" data-iu="'+x.id+'">Up</button><button class="b s" data-id="'+x.id+'">Down</button><button class="b s" data-ix="'+x.id+'">X</button></div></div>'
}
function renderImgs(){
  var el=$("imgs");if(!el)return;
  var ph=mediaList("image"),vd=mediaList("video");
  $("ic").textContent=ph.length+"/20 photos, "+vd.length+"/2 videos";
  el.innerHTML=ph.map(function(x,i){return tile(x,i+1)}).join("")+vd.map(function(x,i){return tile(x,i+1)}).join("")
}
function fullText(f){
  if(f.type==="chips")return val(f).join(", ");
  var el=$("f_"+f.id),v=el?el.value:val(f);
  if(f.footer&&CFG.footer)v=v.replace(/\s+$/,"")+"\n\n"+CFG.footer;
  return v
}
function queue(lid,path,v){
  pend[lid]=pend[lid]||{};pend[lid][path]=v;stat("Saving...");
  clearTimeout(tm[lid]);tm[lid]=setTimeout(function(){flush(lid)},500)
}
function flush(lid){
  busy[lid]=(busy[lid]||Promise.resolve()).then(function(){
    var p=pend[lid]||{};pend[lid]={};if(!Object.keys(p).length)return;
    return updateDoc(doc(db,"listings",lid),p).then(function(){stat("Saved. Everyone sees changes live.")},function(){stat("Could not save");toast("Could not save. Check internet or sign in again.")})
  })
}
function cfgSave(part){return updateDoc(doc(db,"config","v2"),part).catch(function(){toast("Could not save settings")})}
function defVals(){var o={};CFG.fields.forEach(function(f){if(f.type==="chips"&&f.def&&f.def.length)o[f.id]=f.def.slice()});return o}
function newListing(data){
  var id="l"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
  cur=id;
  var d=data||{vals:defVals(),vars:{}};d.created=Date.now();
  return setDoc(doc(db,"listings",id),d).catch(function(){toast("Could not create listing")})
}
function setChips(i,arr){var f=CFG.fields[i];setLocal(L[cur],"vals."+f.id,arr);queue(cur,"vals."+f.id,arr);$("cw_"+f.id).innerHTML=chipsInner(f,i);setCnt(f)}
function addChip(i,text){
  var f=CFG.fields[i],t=text.trim();if(!t)return;
  var v=val(f).slice();
  if(f.each&&t.length>f.each){toast('"'+t.slice(0,18)+'..." is over '+f.each+" characters");return}
  if(f.max&&v.length>=f.max){toast("Maximum "+f.max+" reached");return}
  if(v.some(function(x){return x.toLowerCase()===t.toLowerCase()}))return;
  v.push(t);
  if(!(f.lib||[]).some(function(x){return x.toLowerCase()===t.toLowerCase()})){f.lib=(f.lib||[]).concat([t]);cfgSave({fields:CFG.fields})}
  setChips(i,v)
}
function addChips(i,text){text.split(",").forEach(function(t){addChip(i,t)});var el=$("ci_"+CFG.fields[i].id);if(el){el.value="";el.focus()}}
function vAdd(n,text){
  var t=text.trim();if(!t)return;
  if(CFG[n].some(function(x){return x.toLowerCase()===t.toLowerCase()})){toast("Already added");return}
  CFG[n]=CFG[n].concat([t]);var p={};p[n]=CFG[n];cfgSave(p);$("vwrap").innerHTML=varsInner()
}
function vSet(k,p,v){var path="vars."+k+"."+p;setLocal(L[cur],path,v);queue(cur,path,v)}
function target(r,t){return t==="all"||t==="g:"+r.g||t==="m:"+r.m}
document.addEventListener("input",function(e){
  var t=e.target;
  if(t.dataset.v!==undefined){
    var f=CFG.fields[+t.dataset.v];
    setLocal(L[cur],"vals."+f.id,t.value);queue(cur,"vals."+f.id,t.value);setCnt(f);
    if(f.id==="title"||f.id==="sku")renderList()
  }else if(t.dataset.vp!==undefined){vSet(t.dataset.vp,"price",t.value)}
  else if(t.id==="footer"){CFG.footer=t.value;clearTimeout(tm.footer);tm.footer=setTimeout(function(){cfgSave({footer:CFG.footer})},600)}
});
document.addEventListener("keydown",function(e){
  if(e.key!=="Enter")return;var t=e.target;
  if(t.dataset.ci!==undefined){e.preventDefault();addChips(+t.dataset.ci,t.value)}
  else if(t.dataset.vi!==undefined){e.preventDefault();vAdd(t.dataset.vi,t.value)}
});
document.addEventListener("focusout",function(){setTimeout(function(){if(pendRender)renderMainSafe()},50)});
document.addEventListener("change",function(e){
  var t=e.target;
  if(t.dataset.fl!==undefined){CFG.fields[+t.dataset.fl].label=t.value;cfgSave({fields:CFG.fields})}
  else if(t.dataset.ft!==undefined){var f=CFG.fields[+t.dataset.ft];f.type=t.value;if(t.value==="chips"){f.max=f.max||13;f.each=f.each||45;f.lib=f.lib||[];f.def=f.def||[]}else{delete f.each;delete f.lib;delete f.def}cfgSave({fields:CFG.fields});renderMain()}
  else if(t.dataset.vs!==undefined){vSet(t.dataset.vs,"proc",t.value)}
  else if(t.dataset.vv!==undefined){vSet(t.dataset.vv,"vis",t.checked)}
  else if(t.id==="files"){upload(t.files);t.value=""}
});
async function upload(files){
  var ni=0,nv=0,lid=cur,base=Date.now();
  for(var i=0;i<files.length;i++){
    var f=files[i],isV=f.type.indexOf("video")===0,kind=isV?"video":"image";
    if(isV&&mediaList("video").length+nv>=2){toast("Etsy allows 2 videos");continue}
    if(!isV&&mediaList("image").length+ni>=20){toast("Etsy allows 20 photos");continue}
    stat("Uploading "+(i+1)+" of "+files.length+"...");
    try{
      var fd=new FormData();fd.append("file",f);fd.append("upload_preset",cloudinary.uploadPreset);fd.append("folder","etsy/"+lid);
      var r=await fetch("https://api.cloudinary.com/v1_1/"+cloudinary.cloudName+"/"+kind+"/upload",{method:"POST",body:fd});
      var j=await r.json();
      if(!r.ok||!j.secure_url)throw new Error((j.error&&j.error.message)||"upload failed");
      await setDoc(doc(collection(db,"images")),{lid:lid,name:f.name,size:j.bytes||f.size,url:j.secure_url,type:kind,order:base+i});
      if(isV)nv++;else ni++
    }catch(err){toast("Could not upload "+f.name+": "+err.message)}
  }
  stat("Saved. Everyone sees changes live.")
}
async function swap(id,dir){
  var x=IM.find(function(y){return y.id===id});if(!x)return;
  var a=mediaList(x.type||"image"),i=a.findIndex(function(y){return y.id===id}),j=i+dir;
  if(i<0||j<0||j>=a.length)return;
  try{await updateDoc(doc(db,"images",a[i].id),{order:a[j].order});await updateDoc(doc(db,"images",a[j].id),{order:a[i].order})}catch(e){toast("Could not reorder")}
}
async function rmImg(x){try{await deleteDoc(doc(db,"images",x.id))}catch(e){toast("Could not remove file")}}
async function download(x){
  try{
    var r=await fetch(x.url);var b=await r.blob();
    var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=x.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},5000)
  }catch(e){window.open(x.url,"_blank");toast("Opened in a new tab. Right-click and save.")}
}
document.addEventListener("click",async function(e){
  var b=e.target.closest("button");if(!b)return;
  var d=b.dataset,pr;
  if(b.id==="go"){login()}
  else if(b.id==="out"){signOut(auth)}
  else if(d.go!==undefined){cur=d.go;renderList();renderMain()}
  else if(b.id==="add"){await newListing()}
  else if(d.cp!==undefined){copy(fullText(CFG.fields[+d.cp]))}
  else if(d.cc!==undefined){pr=d.cc.split(":");copy(val(CFG.fields[+pr[0]])[+pr[1]])}
  else if(d.cx!==undefined){pr=d.cx.split(":");var fx=CFG.fields[+pr[0]],vx=val(fx).slice();vx.splice(+pr[1],1);setChips(+pr[0],vx)}
  else if(d.cadd!==undefined){var ie=$("ci_"+CFG.fields[+d.cadd].id);addChips(+d.cadd,ie.value)}
  else if(d.lib!==undefined){pr=d.lib.split(":");var fl=CFG.fields[+pr[0]],name=fl.lib[+pr[1]],cv=val(fl),ix=cv.findIndex(function(x){return x.toLowerCase()===name.toLowerCase()});
    if(ix>=0){cv=cv.slice();cv.splice(ix,1);setChips(+pr[0],cv)}else addChip(+pr[0],name)}
  else if(d.lx!==undefined){pr=d.lx.split(":");var fd2=CFG.fields[+pr[0]];fd2.lib.splice(+pr[1],1);cfgSave({fields:CFG.fields});$("cw_"+fd2.id).innerHTML=chipsInner(fd2,+pr[0])}
  else if(d.cdef!==undefined){var fdd=CFG.fields[+d.cdef];fdd.def=val(fdd).slice();cfgSave({fields:CFG.fields});toast("Saved as default for new listings")}
  else if(d.a==="dup"){var src=L[cur]||{};await newListing({vals:JSON.parse(JSON.stringify(src.vals||{})),vars:JSON.parse(JSON.stringify(src.vars||{}))})}
  else if(d.a==="del"){
    if(confirm("Delete this listing and its photos for everyone?")){
      var id=cur,all=IM.filter(function(x){return x.lid===id});
      cur=ORDER.filter(function(x){return x!==id})[0]||null;
      for(var k=0;k<all.length;k++)await rmImg(all[k]);
      await deleteDoc(doc(db,"listings",id)).catch(function(){toast("Could not delete")})
    }
  }
  else if(d.a==="edit"){edit=!edit;renderMain()}
  else if(d.a==="vedit"){vedit=!vedit;$("vwrap").innerHTML=varsInner()}
  else if(d.a==="addf"){CFG.fields.push({id:"c"+Date.now().toString(36),label:"New field",type:"text",sec:"More details"});cfgSave({fields:CFG.fields});renderMain()}
  else if(d.a==="theme"){var r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme:dark)").matches;r.dataset.theme=dark?"light":"dark"}
  else if(d.a==="bulkp"){var p=$("bp").value.trim(),t=$("bt").value;if(!p){toast("Enter a price first");return}rows().forEach(function(r2){if(target(r2,t)){vSet(r2.k,"price",p);var el=$("vp_"+r2.k);if(el)el.value=p}})}
  else if(d.a==="bulkproc"){var pv=$("bpr").value;rows().forEach(function(r2){vSet(r2.k,"proc",pv);var el=$("vs_"+r2.k);if(el)el.value=pv})}
  else if(d.a==="copyprices"){copy(rows().map(function(r2){return r2.g+" | "+r2.m+" | "+(vget(r2.k,"price")||"")}).join("\n"))}
  else if(d.vc!==undefined){copy(vget(d.vc,"price")||"")}
  else if(d.vadd!==undefined){vAdd(d.vadd,$("vi_"+d.vadd).value)}
  else if(d.vx!==undefined){pr=d.vx.split(":");CFG[pr[0]]=CFG[pr[0]].filter(function(_,ii){return ii!==+pr[1]});var o={};o[pr[0]]=CFG[pr[0]];cfgSave(o);$("vwrap").innerHTML=varsInner()}
  else if(d.up!==undefined){var i=+d.up;if(i>0){CFG.fields.splice(i-1,0,CFG.fields.splice(i,1)[0]);cfgSave({fields:CFG.fields});renderMain()}}
  else if(d.dn!==undefined){var j=+d.dn;if(j<CFG.fields.length-1){CFG.fields.splice(j+1,0,CFG.fields.splice(j,1)[0]);cfgSave({fields:CFG.fields});renderMain()}}
  else if(d.rm!==undefined){if(confirm("Remove this field from all listings?")){CFG.fields.splice(+d.rm,1);cfgSave({fields:CFG.fields});renderMain()}}
  else if(d.dl!==undefined){download(IM.find(function(x){return x.id===d.dl}))}
  else if(d.iu!==undefined){swap(d.iu,-1)}
  else if(d.id!==undefined){swap(d.id,1)}
  else if(d.ix!==undefined){if(confirm("Remove this file?"))rmImg(IM.find(function(x){return x.id===d.ix}))}
});
function login(){
  $("lerr").textContent="";
  signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value).catch(function(){$("lerr").textContent="Wrong email or password."})
}
$("pw").addEventListener("keydown",function(e){if(e.key==="Enter")login()});
function start(){
  stat("Live. Changes save automatically and everyone sees them.");
  var bad=function(){stat("No access or lost connection. Sign in again or reload.")};
  unsubs.push(onSnapshot(doc(db,"config","v2"),function(s){
    if(s.exists()){
      var d=s.data();
      CFG={fields:Array.isArray(d.fields)&&d.fields.length?d.fields:mkFields(),footer:d.footer||"",gems:Array.isArray(d.gems)?d.gems:GEMS.slice(),mats:Array.isArray(d.mats)?d.mats:MATS.slice(),procs:Array.isArray(d.procs)&&d.procs.length?d.procs:PROCS.slice()};
      renderMainSafe()
    }else if(!seeded){seeded=true;setDoc(doc(db,"config","v2"),{fields:mkFields(),footer:"",gems:GEMS,mats:MATS,procs:PROCS})}
  },bad));
  unsubs.push(onSnapshot(query(collection(db,"listings"),orderBy("created","asc")),function(s){
    var prev=cur;L={};ORDER=[];
    s.docs.forEach(function(x){L[x.id]=x.data();ORDER.push(x.id)});
    Object.keys(pend).forEach(function(lid){if(L[lid])Object.keys(pend[lid]).forEach(function(p){setLocal(L[lid],p,pend[lid][p])})});
    if(!ORDER.length){if(!madeFirst){madeFirst=true;newListing()}renderList();return}
    if(!cur||(!L[cur]&&!s.metadata.hasPendingWrites))cur=ORDER[0];
    renderList();
    if(cur!==prev||!$("vwrap"))renderMain();else updateValues()
  },bad));
  unsubs.push(onSnapshot(query(collection(db,"images"),orderBy("order","asc")),function(s){
    IM=s.docs.map(function(x){var d=x.data();d.id=x.id;return d});renderImgs()
  },bad));
}
onAuthStateChanged(auth,function(u){
  unsubs.forEach(function(f){f()});unsubs=[];
  $("login").hidden=!!u;$("app").hidden=!u;
  if(u){seeded=false;madeFirst=false;start()}else{L={};ORDER=[];IM=[];cur=null}
});
