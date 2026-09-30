import {firebaseConfig,cloudinary} from "./firebase-config.js";
import {initializeApp} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {getFirestore,doc,collection,onSnapshot,setDoc,updateDoc,deleteDoc,query,orderBy} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb);

var DEF=[
{id:"title",label:"Title",type:"text",max:140,hint:"Max 140 characters. Put the main keywords first."},
{id:"price",label:"Price",type:"text"},
{id:"qty",label:"Quantity",type:"text"},
{id:"sku",label:"SKU",type:"text"},
{id:"category",label:"Category",type:"text"},
{id:"desc",label:"Description",type:"area",footer:1,hint:"The standard footer (below) is added automatically when you copy."},
{id:"tags",label:"Tags",type:"tags",max:13,each:20,hint:"Comma separated. Max 13 tags, each up to 20 characters."},
{id:"materials",label:"Materials",type:"tags",max:13,each:45,hint:"Comma separated."},
{id:"colors",label:"Colors",type:"text"},
{id:"size",label:"Size / length",type:"text"},
{id:"proc",label:"Processing time",type:"text"},
{id:"pers",label:"Personalization",type:"text"},
{id:"note",label:"Note for Piyush",type:"area"}
];
var CFG={fields:DEF,footer:""},L={},ORDER=[],IM=[],cur=null,edit=false,canW=true,seeded=false,madeFirst=false,pendRender=false,pend={},tm={},busy={},unsubs=[];
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function $(i){return document.getElementById(i)}
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("on");setTimeout(function(){e.classList.remove("on")},1600)}
function stat(t){$("stat").textContent=t}
function copy(t){
  function fb(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");toast("Copied")}catch(e){toast("Copy failed")}a.remove()}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast("Copied")},fb)}else fb()
}
function lname(id){var l=L[id];return (l&&l.vals&&l.vals.title||"").trim()||"Untitled listing"}
function renderList(){
  $("list").innerHTML=ORDER.map(function(id){return '<button class="li'+(id===cur?' on':'')+'" data-go="'+id+'">'+esc(lname(id))+'</button>'}).join("")
}
function counter(f,v){
  if(f.type==="text"&&f.max)return {t:v.length+"/"+f.max,bad:v.length>f.max};
  if(f.type==="tags"){var a=v.split(",").map(function(x){return x.trim()}).filter(Boolean);var long=a.filter(function(x){return x.length>f.each}).length;
    return {t:a.length+"/"+f.max+" tags"+(long?" - "+long+" too long":""),bad:a.length>f.max||long>0}}
  return {t:v.length?v.length+" chars":"",bad:false}
}
function val(f){return (L[cur]&&L[cur].vals&&L[cur].vals[f.id])||""}
function renderMain(){
  pendRender=false;
  if(!cur){$("main").innerHTML="";return}
  var ro=canW?"":" readonly";
  var h='<div class="bar">'+(canW?'<button class="b s" data-a="dup">Duplicate listing</button><button class="b s" data-a="del">Delete listing</button><button class="b s" data-a="edit">'+(edit?"Done editing fields":"Edit fields")+'</button>':'')+'<button class="b s" data-a="theme">Light / dark</button></div>';
  CFG.fields.forEach(function(f,i){
    var v=val(f),c=counter(f,v);
    h+='<div class="f">';
    if(edit&&canW)h+='<div class="ed"><input type="text" data-fl="'+i+'" value="'+esc(f.label)+'" aria-label="Field name"><select data-ft="'+i+'"><option value="text"'+(f.type==="text"?" selected":"")+'>Short text</option><option value="area"'+(f.type==="area"?" selected":"")+'>Long text</option><option value="tags"'+(f.type==="tags"?" selected":"")+'>Tags</option></select><button class="b s" data-up="'+i+'">Up</button><button class="b s" data-dn="'+i+'">Down</button><button class="b s" data-rm="'+i+'">Remove</button></div>';
    h+='<div class="fh"><label for="f_'+f.id+'">'+esc(f.label)+'</label><span class="cnt'+(c.bad?' bad':'')+'" id="c_'+f.id+'">'+esc(c.t)+'</span><button class="b s" data-cp="'+i+'">Copy</button></div>';
    h+=f.type==="area"?'<textarea id="f_'+f.id+'" data-v="'+i+'"'+ro+'>'+esc(v)+'</textarea>':'<input type="text" id="f_'+f.id+'" data-v="'+i+'" value="'+esc(v)+'"'+ro+'>';
    if(f.hint)h+='<p class="hint">'+esc(f.hint)+'</p>';
    h+='</div>'
  });
  if(edit&&canW)h+='<button class="b p" data-a="addf" style="margin-bottom:12px">Add field</button>';
  h+='<div class="f"><div class="fh"><label for="footer">Standard description footer</label></div><textarea id="footer" style="min-height:70px"'+ro+' placeholder="Shipping, care, returns. Added to every description when copied.">'+esc(CFG.footer)+'</textarea></div>';
  h+='<div class="f"><div class="fh"><label>Photos</label><span class="cnt" id="ic"></span></div>'+(canW?'<input type="file" id="files" accept="image/*" multiple>':'')+'<p class="hint">Photos are stored exactly as uploaded (no compression, up to 20 MB each). Use Download to get the original file. Etsy takes up to 20 photos, the first is the main one.</p><div class="imgs" id="imgs"></div></div>';
  $("main").innerHTML=h;
  renderImgs()
}
function renderMainSafe(){
  var a=document.activeElement;
  if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA")&&$("main").contains(a)){pendRender=true;return}
  renderMain()
}
function updateValues(){
  CFG.fields.forEach(function(f){
    var el=$("f_"+f.id);if(!el||el===document.activeElement)return;
    var v=val(f);if(el.value!==v){el.value=v}
    var c=counter(f,v),ce=$("c_"+f.id);if(ce){ce.textContent=c.t;ce.className="cnt"+(c.bad?" bad":"")}
  })
}
function myImgs(){return IM.filter(function(x){return x.lid===cur})}
function renderImgs(){
  var el=$("imgs");if(!el)return;
  var a=myImgs();
  $("ic").textContent=a.length+"/20";
  el.innerHTML=a.map(function(x,i){return '<div class="im"><img loading="lazy" src="'+esc(x.url.replace('/upload/','/upload/w_300,h_300,c_fill,q_auto/'))+'" alt=""><div title="'+esc(x.name)+'">'+(i+1)+'. '+esc(x.name)+'</div><div>'+(x.size/1048576).toFixed(2)+' MB</div><div class="r"><button class="b s" data-dl="'+x.id+'">Download</button>'+(canW?'<button class="b s" data-iu="'+x.id+'">Up</button><button class="b s" data-id="'+x.id+'">Down</button><button class="b s" data-ix="'+x.id+'">X</button>':'')+'</div></div>'}).join("")
}
function fullText(f){
  var el=$("f_"+f.id),v=el?el.value:val(f);
  if(f.footer&&CFG.footer)v=v.replace(/\s+$/,"")+"\n\n"+CFG.footer;
  return v
}

function queue(lid,fid,v){
  pend[lid]=pend[lid]||{};pend[lid][fid]=v;stat("Saving...");
  clearTimeout(tm[lid]);tm[lid]=setTimeout(function(){flush(lid)},500)
}
function flush(lid){
  busy[lid]=(busy[lid]||Promise.resolve()).then(function(){
    var p=pend[lid];pend[lid]={};var ks=Object.keys(p||{});if(!ks.length)return;
    var patch={};ks.forEach(function(k){patch["vals."+k]=p[k]});
    return updateDoc(doc(db,"listings",lid),patch).then(function(){stat("Saved. Everyone sees changes live.")},function(){stat("Could not save");toast("Could not save. Check internet or sign in again.")})
  })
}
function cfgSave(part){return updateDoc(doc(db,"config","main"),part).catch(function(){toast("Could not save settings")})}
function newListing(vals){
  var id="l"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
  cur=id;
  return setDoc(doc(db,"listings",id),{vals:vals||{},created:Date.now()}).catch(function(){toast("Could not create listing")})
}
document.addEventListener("input",function(e){
  var t=e.target;
  if(t.dataset.v!==undefined){
    var f=CFG.fields[+t.dataset.v];
    if(L[cur]){L[cur].vals=L[cur].vals||{};L[cur].vals[f.id]=t.value}
    var c=counter(f,t.value),el=$("c_"+f.id);el.textContent=c.t;el.className="cnt"+(c.bad?" bad":"");
    if(f.id==="title"){var b=document.querySelector('[data-go="'+cur+'"]');if(b)b.textContent=t.value.trim()||"Untitled listing"}
    queue(cur,f.id,t.value)
  }else if(t.id==="footer"){CFG.footer=t.value;clearTimeout(tm.footer);tm.footer=setTimeout(function(){cfgSave({footer:CFG.footer})},600)}
});
document.addEventListener("focusout",function(){setTimeout(function(){if(pendRender)renderMainSafe()},50)});
document.addEventListener("change",function(e){
  var t=e.target;
  if(t.dataset.fl!==undefined){CFG.fields[+t.dataset.fl].label=t.value;cfgSave({fields:CFG.fields})}
  else if(t.dataset.ft!==undefined){var f=CFG.fields[+t.dataset.ft];f.type=t.value;if(t.value==="tags"){f.max=f.max||13;f.each=f.each||20}else{delete f.max;delete f.each}cfgSave({fields:CFG.fields});renderMain()}
  else if(t.id==="files"){upload(t.files);t.value=""}
});
async function upload(files){
  var base=Date.now(),n=0,lid=cur;
  for(var i=0;i<files.length;i++){
    if(myImgs().length+n>=20){toast("Etsy allows 20 photos per listing");break}
    var f=files[i];stat("Uploading "+(i+1)+" of "+files.length+"...");
    try{
      var fd=new FormData();fd.append("file",f);fd.append("upload_preset",cloudinary.uploadPreset);fd.append("folder","etsy/"+lid);
      var r=await fetch("https://api.cloudinary.com/v1_1/"+cloudinary.cloudName+"/image/upload",{method:"POST",body:fd});
      var j=await r.json();
      if(!r.ok||!j.secure_url)throw new Error((j.error&&j.error.message)||"upload failed");
      await setDoc(doc(collection(db,"images")),{lid:lid,name:f.name,size:j.bytes||f.size,url:j.secure_url,order:base+i});n++
    }catch(err){toast("Could not upload "+f.name+": "+err.message)}
  }
  stat("Saved. Everyone sees changes live.")
}
async function swap(id,dir){
  var a=myImgs(),i=a.findIndex(function(x){return x.id===id}),j=i+dir;
  if(i<0||j<0||j>=a.length)return;
  try{await updateDoc(doc(db,"images",a[i].id),{order:a[j].order});await updateDoc(doc(db,"images",a[j].id),{order:a[i].order})}catch(e){toast("Could not reorder")}
}
async function rmImg(x){
  try{await deleteDoc(doc(db,"images",x.id))}catch(e){toast("Could not remove photo")}
}
async function download(x){
  try{
    var r=await fetch(x.url);var b=await r.blob();
    var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=x.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},5000)
  }catch(e){window.open(x.url,"_blank");toast("Opened in a new tab. Right-click and save the image.")}
}
document.addEventListener("click",async function(e){
  var b=e.target.closest("button");if(!b)return;
  var d=b.dataset;
  if(b.id==="go"){login()}
  else if(b.id==="out"){signOut(auth)}
  else if(d.go!==undefined){cur=d.go;renderList();renderMain()}
  else if(b.id==="add"){await newListing()}
  else if(d.cp!==undefined){copy(fullText(CFG.fields[+d.cp]))}
  else if(d.a==="dup"){var v=JSON.parse(JSON.stringify((L[cur]&&L[cur].vals)||{}));await newListing(v)}
  else if(d.a==="del"){
    if(confirm("Delete this listing and its photos for everyone?")){
      var id=cur,imgs=myImgs();
      cur=ORDER.filter(function(x){return x!==id})[0]||null;
      for(var k=0;k<imgs.length;k++)await rmImg(imgs[k]);
      await deleteDoc(doc(db,"listings",id)).catch(function(){toast("Could not delete")})
    }
  }
  else if(d.a==="edit"){edit=!edit;renderMain()}
  else if(d.a==="addf"){CFG.fields.push({id:"c"+Date.now().toString(36),label:"New field",type:"text"});cfgSave({fields:CFG.fields});renderMain()}
  else if(d.a==="theme"){var r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme:dark)").matches;r.dataset.theme=dark?"light":"dark"}
  else if(d.up!==undefined){var i=+d.up;if(i>0){CFG.fields.splice(i-1,0,CFG.fields.splice(i,1)[0]);cfgSave({fields:CFG.fields});renderMain()}}
  else if(d.dn!==undefined){var j=+d.dn;if(j<CFG.fields.length-1){CFG.fields.splice(j+1,0,CFG.fields.splice(j,1)[0]);cfgSave({fields:CFG.fields});renderMain()}}
  else if(d.rm!==undefined){if(confirm("Remove this field from all listings?")){CFG.fields.splice(+d.rm,1);cfgSave({fields:CFG.fields});renderMain()}}
  else if(d.dl!==undefined){download(IM.find(function(x){return x.id===d.dl}))}
  else if(d.iu!==undefined){swap(d.iu,-1)}
  else if(d.id!==undefined){swap(d.id,1)}
  else if(d.ix!==undefined){if(confirm("Remove this photo?"))rmImg(IM.find(function(x){return x.id===d.ix}))}
});
function login(){
  $("lerr").textContent="";
  signInWithEmailAndPassword(auth,$("em").value.trim(),$("pw").value).catch(function(){$("lerr").textContent="Wrong email or password."})
}
$("pw").addEventListener("keydown",function(e){if(e.key==="Enter")login()});
function start(){
  stat("Live. Changes save automatically and everyone sees them.");
  var bad=function(){stat("No access or lost connection. Sign in again or reload.")};
  unsubs.push(onSnapshot(doc(db,"config","main"),function(s){
    if(s.exists()){var d=s.data();CFG={fields:Array.isArray(d.fields)&&d.fields.length?d.fields:DEF,footer:d.footer||""};renderMainSafe()}
    else if(!seeded){seeded=true;setDoc(doc(db,"config","main"),{fields:DEF,footer:""})}
  },bad));
  unsubs.push(onSnapshot(query(collection(db,"listings"),orderBy("created","asc")),function(s){
    var prev=cur;L={};ORDER=[];
    s.docs.forEach(function(x){L[x.id]=x.data();ORDER.push(x.id)});
    if(!ORDER.length){if(!madeFirst){madeFirst=true;newListing()}renderList();return}
    if(!cur||(!L[cur]&&!s.metadata.hasPendingWrites))cur=ORDER[0];
    renderList();
    if(cur!==prev||!$("f_"+CFG.fields[0].id))renderMain();else updateValues()
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
