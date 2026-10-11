import OlMap from 'https://esm.sh/ol@10.7.0/Map.js';
import View from 'https://esm.sh/ol@10.7.0/View.js';
import TileLayer from 'https://esm.sh/ol@10.7.0/layer/Tile.js';
import VectorLayer from 'https://esm.sh/ol@10.7.0/layer/Vector.js';
import WebGLVectorLayer from 'https://esm.sh/ol@10.7.0/layer/WebGLVector.js';
import OSM from 'https://esm.sh/ol@10.7.0/source/OSM.js';
import VectorSource from 'https://esm.sh/ol@10.7.0/source/Vector.js';
import GeoJSON from 'https://esm.sh/ol@10.7.0/format/GeoJSON.js';
import Feature from 'https://esm.sh/ol@10.7.0/Feature.js';
import Point from 'https://esm.sh/ol@10.7.0/geom/Point.js';
import LineString from 'https://esm.sh/ol@10.7.0/geom/LineString.js';
import CircleStyle from 'https://esm.sh/ol@10.7.0/style/Circle.js';
import TextStyle from 'https://esm.sh/ol@10.7.0/style/Text.js';
import Polygon from 'https://esm.sh/ol@10.7.0/geom/Polygon.js';
import {Fill,Stroke,Style} from 'https://esm.sh/ol@10.7.0/style.js';
import {fromLonLat,toLonLat,transformExtent} from 'https://esm.sh/ol@10.7.0/proj.js';
const $=id=>document.getElementById(id);
const ignUrl='https://xyz-mdt.idee.es/1.0.0/raster-dem';
const cogUrl='https://huggingface.co/datasets/aTaromOCD/Spain_MDT05_INT16_WGS84/resolve/main/Spain_MDT05_INT16_WGS84.tif';
const postpass='https://postpass.geofabrik.de/api/interpreter';
const zoomRange=[15,14,13];
let effectiveZoom=null;
const blockSize=400;
const modeFields={ign:['ignZoom','ignBudget','ignParallel','ignCache'],cog:['cogParallel','cogCache'],local:['localParallel','localWindow','localWorkers','localCache']};
const modeDefaults={ignZoom:'auto',ignBudget:'120',ignParallel:'8',ignCache:'256',cogParallel:'8',cogCache:'256',localParallel:'24',localWindow:'minimum',localWorkers:'2',localCache:'256'};
const settingsKey='osm-elevation-qa-mode-settings-v11';
const filterSettingsKey='osm-elevation-qa-filters-v12';
const workspaceSettingsKey='osm-elevation-qa-layout-v12';
let currentTool='qa';
let itemProfile=null;
let activeSample=0;
let activeSampleStyle=null;
let nearbyEnabled=false;
let nearbyAbort=null;
let nearbySearchId=0;
const nearbyEndpoint='https://overpass-api.de/api/interpreter';
const cache={ign:new Map(),cog:new Map(),local:new Map()};
const validExtent=[-18.166270531442596,27.6325987,4.498137,43.851483050753671];
const sources={ign:'IGN XYZ',cog:'Hugging Face COG',local:'COG local'};
let image=null;
let localImage=null;
let localFile=null;
let loadingGeoTiff=null;
let postpassCache=null;
let postpassWasReused=false;
let openingCOG=null;
let openingLocal=null;
let localPool=null;
let localPoolSize=0;
const retiredPools=new Set();
let poolFailed=false;
let matrixBytes=0;
let windowMisses=0;
let coverage=[];
let results=[];
let currentAbort=null;
let busy=false;
let totalStarted=0;
let activePhase=null;
let phaseStarted=0;
let timingInterval=null;
let reads=0;
let uniqueGroups=0;
let cacheHits=0;
let failedGroups=0;
let sortedDiffs=[];
let maxDifference=0;
const timings={postpass:null,setup:null,prepare:null,mdt:null,render:null,total:null};
const timeElements={postpass:'timePostpass',setup:'timeSetup',prepare:'timePrepare',mdt:'timeMdt',render:'timeRender',total:'timeTotal'};
const featureSource=new VectorSource({wrapX:false});
const selectionSource=new VectorSource({wrapX:false});
let selectedQaFeature=null;
const base=new TileLayer({source:new OSM({crossOrigin:'anonymous'}),className:'ol-layer dark-base-layer'});
const shadeSource=new VectorSource({wrapX:false});
const shadeLayer=new VectorLayer({source:shadeSource,style:new Style({fill:new Fill({color:'rgba(3,12,9,0.72)'})}),zIndex:3});
const borderSource=new VectorSource({wrapX:false});
const borderLayer=new VectorLayer({source:borderSource,style:new Style({stroke:new Stroke({color:'#8ad6a3',width:1.6})}),zIndex:4});
const resultLayer=new WebGLVectorLayer({source:featureSource,style:[{filter:['>', ['get','diff'],['var','threshold']],style:{'circle-radius':6,'circle-fill-color':['interpolate',['linear'],['get','diff'],0,'#80d9a6',25,'#f8d76a',100,'#f2825c'],'circle-stroke-color':'#f5f7ee','circle-stroke-width':1.2}}],variables:{threshold:10},zIndex:5});
const selectionLayer=new VectorLayer({source:selectionSource,zIndex:18,style:f=>[new Style({image:new CircleStyle({radius:26,fill:new Fill({color:'rgba(255,73,206,0.15)'}),stroke:new Stroke({color:'#100e14',width:5})})}),new Style({image:new CircleStyle({radius:20,fill:new Fill({color:'rgba(18,12,17,0.4)'}),stroke:new Stroke({color:'#ff49ce',width:5})}),text:new TextStyle({text:f.get('selectedLabel'),font:'bold 13px system-ui,sans-serif',fill:new Fill({color:'#ffffff'}),backgroundFill:new Fill({color:'#291722'}),backgroundStroke:new Stroke({color:'#ff49ce',width:2}),padding:[5,8,5,8],offsetY:-46})}),new Style({image:new CircleStyle({radius:5,fill:new Fill({color:'#ffffff'}),stroke:new Stroke({color:'#23121c',width:1.5})})})]});
const itemVector=new VectorSource({wrapX:false});
const nearbyVector=new VectorSource({wrapX:false});
const nearbyLayer=new VectorLayer({source:nearbyVector,zIndex:12,style:new Style({image:new CircleStyle({radius:8,fill:new Fill({color:'rgba(13,31,27,0.65)'}),stroke:new Stroke({color:'#62e6ed',width:3})})})});
const drawVector=new VectorSource({wrapX:false});
let drawPoints=[];
let drawingEnabled=false;
let selectedDraw=0;
const drawLayer=new VectorLayer({source:drawVector,zIndex:9,style:f=>{if(f.get('drawKind')==='line')return new Style({stroke:new Stroke({color:'#ffc66d',width:3})});const active=f.get('drawSelected');return new Style({image:new CircleStyle({radius:active?9:6,fill:new Fill({color:active?'#f5f3e8':'#ffc66d'}),stroke:new Stroke({color:active?'#e05ba7':'#19271e',width:active?3:2})})});}});
const itemLayer=new VectorLayer({source:itemVector,zIndex:6,style:f=>{const kind=f.get('itemKind');if(kind==='line')return new Style({stroke:new Stroke({color:'#73e0ad',width:4})});return new Style({image:new CircleStyle({radius:kind==='active'?8:6,fill:new Fill({color:kind==='active'?'#f9c66d':'#a0f0bf'}),stroke:new Stroke({color:'#0d2719',width:2})})});}});
const map=new OlMap({target:'map',layers:[base,shadeLayer,borderLayer,resultLayer,itemLayer,drawLayer,nearbyLayer,selectionLayer],view:new View({center:fromLonLat([-3.7,40.25]),zoom:6.5,maxZoom:19,extent:transformExtent([-25,22,12,49],'EPSG:4326','EPSG:3857')}),controls:undefined});
function status(msg){$('status').textContent=msg;}
function count(n){return Number(n).toLocaleString('es-ES');}
function formatTime(ms){return ms<1000?`${Math.round(ms)} ms`:`${(ms/1000).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})} s`;}
function sourceName(){return sources[$('source').value];}
function itemStatus(message){$('itemStatus').textContent=message;}
function updateMapSize(){requestAnimationFrame(()=>map.updateSize());}
function openSettings(){if(busy)return;$('drawerSourceName').textContent=sourceName();$('settingsDrawer').hidden=false;$('drawerBackdrop').hidden=false;$('closeSettings').focus();}
function closeSettings(){$('settingsDrawer').hidden=true;$('drawerBackdrop').hidden=true;$('openSettings').focus();}
$('openSettings').addEventListener('click',openSettings);
$('closeSettings').addEventListener('click',closeSettings);
$('drawerBackdrop').addEventListener('click',closeSettings);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('settingsDrawer').hidden)closeSettings();});
const compactLayout=matchMedia('(max-width:690px), (max-height:520px) and (pointer:coarse)');
let mobileToolsOpen=false;
let mobileResultsOpen=false;
let desktopResultsOpen=true;
function displayResults(open){$('resultsPanel').classList.toggle('collapsed',!open);$('resultToggle').textContent=open?'Contraer ▾':'Expandir ▴';$('resultToggle').setAttribute('aria-expanded',String(open));updateMapSize();}
function displayTools(open){mobileToolsOpen=open;$('app').classList.toggle('mobile-panel-open',compactLayout.matches&&open);$('sidebarToggle').setAttribute('aria-expanded',String(compactLayout.matches?open:!$('app').classList.contains('sidebar-closed')));updateMapSize();}
function saveLayout(){try{localStorage.setItem(workspaceSettingsKey,JSON.stringify({sidebar:!$('app').classList.contains('sidebar-closed'),results:desktopResultsOpen}));}catch(e){}}
try{const layout=JSON.parse(localStorage.getItem(workspaceSettingsKey));if(layout?.sidebar===false)$('app').classList.add('sidebar-closed');if(layout?.results===false)desktopResultsOpen=false;}catch(e){}
function refreshLayout(){displayTools(false);displayResults(compactLayout.matches?mobileResultsOpen:desktopResultsOpen);}
$('sidebarToggle').addEventListener('click',()=>{if(compactLayout.matches){displayTools(!mobileToolsOpen);return;}$('app').classList.toggle('sidebar-closed');displayTools(false);saveLayout();});
$('resultToggle').addEventListener('click',()=>{if(compactLayout.matches)mobileResultsOpen=!mobileResultsOpen;else desktopResultsOpen=!desktopResultsOpen;displayResults(compactLayout.matches?mobileResultsOpen:desktopResultsOpen);if(!compactLayout.matches)saveLayout();});
$('mapWrapper').addEventListener('pointerdown',()=>{if(compactLayout.matches&&mobileToolsOpen)displayTools(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileToolsOpen)displayTools(false);});
compactLayout.addEventListener('change',refreshLayout);
refreshLayout();
function selectTool(name){if(busy)return;if(name!=='item')disableNearby(true);if(compactLayout.matches&&mobileToolsOpen)displayTools(false);const previous=currentTool;if(previous==='draw'&&name!=='draw'){drawingEnabled=false;updateDrawControls();clearItem();}currentTool=name;for(const tab of document.querySelectorAll('[data-tool]')){const active=tab.dataset.tool===name;tab.classList.toggle('active',active);if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}$('qaTool').hidden=name!=='qa';$('itemTool').hidden=name!=='item';$('drawTool').hidden=name!=='draw';$('qaResultsView').hidden=name!=='qa';$('itemResultsView').hidden=name==='qa';$('resultTitle').textContent=name==='qa'?'Resultados del QA':name==='item'?'Consulta de elemento OSM':'Perfil dibujado';$('resultSubtitle').textContent=name==='qa'?'Diferencias entre ele=* y MDT05':name==='item'?'Elevación y perfil del elemento':'Elevaciones MDT05 de los vértices';resultLayer.setVisible(name==='qa');itemLayer.setVisible(name==='item');drawLayer.setVisible(name==='draw');selectionLayer.setVisible(name==='qa');if(name!=='qa')clearQaSelection();if(name==='draw'&&previous!=='draw'){clearItem();renderDraw();}updateDrawControls();updateMapSize();}
for(const tab of document.querySelectorAll('[data-tool]'))tab.addEventListener('click',()=>selectTool(tab.dataset.tool));
function updateTimes(){for(const [key,id] of Object.entries(timeElements)){const value=timings[key];const running=key==='total'&&busy?performance.now()-totalStarted:key===activePhase?performance.now()-phaseStarted:null;$(id).textContent=value!==null?formatTime(value):running!==null?`${formatTime(running)}…`:'—';}$('readBlocks').textContent=count(reads);$('uniqueBlocks').textContent=count(uniqueGroups);$('cacheHits').textContent=count(cacheHits);$('failedBlocks').textContent=count(failedGroups);$('matrixBytes').textContent=(matrixBytes/1048576).toLocaleString('es-ES',{maximumFractionDigits:2})+' MiB';$('windowMisses').textContent=count(windowMisses);$('workerStatus').textContent=$('source').value==='local'?poolFailed?'Fallback: hilo principal':Number($('localWorkers').value)?`${$('localWorkers').value} workers`:'Hilo principal':'—';}
function startPhase(name){activePhase=name;phaseStarted=performance.now();updateTimes();}
function finishPhase(name){timings[name]=performance.now()-phaseStarted;activePhase=null;updateTimes();}
function countAbove(threshold){let low=0,high=sortedDiffs.length;while(low<high){const mid=(low+high)>>1;if(sortedDiffs[mid]<=threshold)low=mid+1;else high=mid;}return sortedDiffs.length-low;}
function updateStats(){const threshold=Number($('threshold').value);$('thresholdValue').textContent=threshold;$('total').textContent=results._total==null?'—':count(results._total);$('compared').textContent=count(results.length);$('visible').textContent=count(countAbove(threshold));$('skipped').textContent=results._skipped==null?'—':count(results._skipped);$('errors').textContent=results._failed==null?'—':count(results._failed);$('cached').textContent=count(cache[$('source').value]?.size||0);$('usedZoom').textContent=effectiveZoom===null?'—':`z${effectiveZoom}`;$('postpassReused').textContent=postpassWasReused?'Sí':'No';$('maxDiff').textContent=results.length?maxDifference.toFixed(1)+' m':'—';}
function resetAnalysis(){for(const k of Object.keys(timings))timings[k]=null;reads=0;uniqueGroups=0;cacheHits=0;failedGroups=0;matrixBytes=0;windowMisses=0;sortedDiffs=[];maxDifference=0;effectiveZoom=null;postpassWasReused=false;results=[];featureSource.clear();clearQaSelection();updateTimes();updateStats();}
$('threshold').addEventListener('input',()=>{resultLayer.updateStyleVariables({threshold:Number($('threshold').value)});if(selectedQaFeature&&Number(selectedQaFeature.get('diff'))<=Number($('threshold').value))clearQaSelection();updateStats();});
function applyField(id,value){const field=$(id);if(field.type==='checkbox'){if(typeof value==='boolean')field.checked=value;return;}if(typeof value==='string'&&Array.from(field.options).some(option=>option.value===value))field.value=value;}
function restoreSettings(){let saved={};try{saved=JSON.parse(localStorage.getItem(settingsKey))||{};}catch(e){}for(const id of Object.keys(modeDefaults))applyField(id,saved[id]??modeDefaults[id]);}
function saveSettings(){const values={};for(const id of Object.keys(modeDefaults)){const field=$(id);values[id]=field.type==='checkbox'?field.checked:field.value;}try{localStorage.setItem(settingsKey,JSON.stringify(values));}catch(e){}}
function showMode(){const selected=$('source').value;for(const mode of Object.keys(modeFields))$(`${mode}Settings`).hidden=selected!==mode;$('drawerSourceName').textContent=sourceName();}
function trimModeCache(mode){const store=cache[mode];if(!store)return;const max=Number($(`${mode}Cache`).value);while(store.size>max)store.delete(store.keys().next().value);}
function resetPool(){const previous=localPool;localPool=null;localPoolSize=0;poolFailed=false;if(previous)previous.destroy().catch(()=>{});}
function settingsChanged(id){if(id==='localWorkers')resetPool();if(id==='localWindow')cache.local.clear();clearDraw();clearItem();renderDraw();const mode=Object.entries(modeFields).find(([,fields])=>fields.includes(id))?.[0];if(mode&&id.endsWith('Cache'))trimModeCache(mode);saveSettings();resetAnalysis();status(`Configuración de ${sources[mode]} actualizada. Pulsa «Analizar zona visible».`);}
for(const fields of Object.values(modeFields))for(const id of fields)$(id).addEventListener('change',()=>settingsChanged(id));
for(const button of document.querySelectorAll('[data-reset]'))button.addEventListener('click',()=>{const mode=button.dataset.reset;for(const id of modeFields[mode])applyField(id,modeDefaults[id]);if(mode==='local'){resetPool();cache.local.clear();}trimModeCache(mode);saveSettings();resetAnalysis();clearDraw();clearItem();renderDraw();status(`Valores predeterminados restaurados para ${sources[mode]}.`);});
restoreSettings();
showMode();
$('source').addEventListener('change',()=>{resetAnalysis();clearDraw();clearItem();renderDraw();showMode();status($('source').value==='local'&&!localFile?'Selecciona un GeoTIFF local para comenzar.':`Fuente seleccionada: ${sourceName()}. Pulsa «Analizar zona visible».`);itemStatus(`Fuente: ${sourceName()}. Introduce un ID para consultar.`);if($('source').value==='local'&&!localFile)openSettings();});
$('localFile').addEventListener('change',event=>{localFile=event.target.files?.[0]||null;localImage=null;openingLocal=null;poolFailed=false;cache.local.clear();resetAnalysis();clearDraw();clearItem();renderDraw();$('localInfo').textContent=localFile?`${localFile.name} · ${(localFile.size/1073741824).toLocaleString('es-ES',{maximumFractionDigits:2})} GiB · permanece en tu equipo`:'Selecciona el GeoTIFF original de tu ordenador. Se lee desde Firefox y nunca se sube a Internet.';status(localFile?'Archivo local seleccionado. Pulsa «Analizar zona visible».':'Selecciona un GeoTIFF local para comenzar.');});
function inCoverage(lon,lat){const point=fromLonLat([lon,lat]);return coverage.some(f=>f.getGeometry().intersectsCoordinate(point));}
function touch(store,key,value,mode){store.delete(key);store.set(key,value);if(store.size>Number($(`${mode}Cache`).value))store.delete(store.keys().next().value);}
function tilePosition(lat,lon,zoom){const size=2**zoom;const x=(lon+180)/360*size;const y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*size;return {tx:Math.floor(x),ty:Math.floor(y),fx:x%1,fy:y%1,zoom};}
function chooseZoom(points){const selected=$('ignZoom').value;if(selected!=='auto')return Number(selected);for(const z of zoomRange){const unique=new Set();for(const p of points){const pos=tilePosition(p.lat,p.lon,z);unique.add(`${pos.zoom}:${pos.tx}:${pos.ty}`);if(unique.size>Number($('ignBudget').value))break;}if(unique.size<=Number($('ignBudget').value))return z;}return 13;}
function cogPosition(lat,lon,raster){const [ox,oy]=raster.getOrigin();const [rx,ry]=raster.getResolution();const px=Math.floor((lon-ox)/rx);const py=Math.floor((lat-oy)/ry);return {px,py,bx:Math.floor(px/blockSize)*blockSize,by:Math.floor(py/blockSize)*blockSize};}
function checkPosition(pos,source,raster){return source==='ign'?pos.tx>=0&&pos.ty>=0&&pos.tx<2**pos.zoom&&pos.ty<2**pos.zoom:pos.px>=0&&pos.py>=0&&pos.px<raster.getWidth()&&pos.py<raster.getHeight();}
function positionKey(pos,source){return source==='ign'?`${pos.zoom}:${pos.tx}:${pos.ty}`:`${pos.bx}:${pos.by}`;}
async function ensureGeoTiff(){
if(window.GeoTIFF)return;
if(!loadingGeoTiff)loadingGeoTiff=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/geotiff@3.0.5/dist-browser/geotiff.js';script.onload=resolve;script.onerror=()=>reject(Error('No se pudo cargar geotiff.js'));document.head.appendChild(script);}).catch(err=>{loadingGeoTiff=null;throw err;});
await loadingGeoTiff;
}
async function ensureCOG(){
if(image)return image;
if(openingCOG)return openingCOG;
openingCOG=(async()=>{await ensureGeoTiff();const file=await window.GeoTIFF.fromUrl(cogUrl,{blockSize:65536,cacheSize:512,maxRanges:0});return file.getImage();})();
try{image=await openingCOG;return image;}finally{openingCOG=null;}
}
async function ensureLocal(){
if(!localFile)throw Error('Selecciona primero tu GeoTIFF local');
if(localImage)return localImage;
if(openingLocal)return openingLocal;
openingLocal=(async()=>{await ensureGeoTiff();const file=await window.GeoTIFF.fromBlob(localFile);const raster=await file.getImage();if(raster.getWidth()!==410683||raster.getHeight()!==293889)throw Error('El archivo no coincide con las dimensiones esperadas del MDT05 (410683 × 293889)');return raster;})();
try{localImage=await openingLocal;return localImage;}finally{openingLocal=null;}
}
async function loadTile(group,signal){
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const saved=cache.ign.get(group.key);
if(saved!==undefined){cacheHits++;touch(cache.ign,group.key,saved,'ign');return saved;}
let error;
for(let attempt=0;attempt<2;attempt++){
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
try{
reads++;
const response=await fetch(`${ignUrl}/${group.zoom}/${group.tx}/${group.ty}.png`,{signal});
if(response.status===204||response.status===404){touch(cache.ign,group.key,null,'ign');return null;}
if(!response.ok)throw Error(`IGN HTTP ${response.status}`);
const bitmap=await createImageBitmap(await response.blob());
const canvas=document.createElement('canvas');
canvas.width=bitmap.width;
canvas.height=bitmap.height;
const ctx=canvas.getContext('2d',{willReadFrequently:true});
if(!ctx){bitmap.close();throw Error('Canvas 2D no disponible');}
ctx.drawImage(bitmap,0,0);
bitmap.close();
const entry={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,w:canvas.width,h:canvas.height};
touch(cache.ign,group.key,entry,'ign');
return entry;
}catch(err){if(signal.aborted||err.name==='AbortError')throw err;error=err;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,500));}
}
throw error;
}
function groupWindow(group,source,raster){
const x1=group.bx;
const y1=group.by;
const x2=Math.min(blockSize,raster.getWidth()-x1)+x1;
const y2=Math.min(blockSize,raster.getHeight()-y1)+y1;
if(source!=='local'||$('localWindow').value==='full')return {x0:x1,y0:y1,w:x2-x1,h:y2-y1};
let left=x2,right=x1,top=y2,bottom=y1;
for(const p of group.points){if(p.px<left)left=p.px;if(p.px>=right)right=p.px+1;if(p.py<top)top=p.py;if(p.py>=bottom)bottom=p.py+1;}
return {x0:left,y0:top,w:right-left,h:bottom-top};
}
function coversWindow(saved,window){return saved.x0<=window.x0&&saved.y0<=window.y0&&saved.x0+saved.w>=window.x0+window.w&&saved.y0+saved.h>=window.y0+window.h;}
function decodingPool(){
const size=Number($('localWorkers').value);
if(!size||poolFailed)return null;
if(localPool&&localPoolSize===size)return localPool;
if(!window.GeoTIFF?.Pool){poolFailed=true;return null;}
try{localPool=new window.GeoTIFF.Pool(size);localPoolSize=size;return localPool;}catch(e){poolFailed=true;return null;}
}
async function loadCOGBlock(group,signal,source,raster){
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const store=cache[source];
const win=groupWindow(group,source,raster);
const saved=store.get(group.key);
if(saved&&coversWindow(saved,win)){cacheHits++;touch(store,group.key,saved,source);return saved;}
if(saved)windowMisses++;
let error;
for(let attempt=0;attempt<2;attempt++){
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
try{
let pool=source==='local'?decodingPool():null;
let pixels;
reads++;
try{const data=await raster.readRasters({window:[win.x0,win.y0,win.x0+win.w,win.y0+win.h],samples:[0],signal,...(pool?{pool}:{})});pixels=data[0];}
catch(err){
if(!pool||signal.aborted||err.name==='AbortError')throw err;
poolFailed=true;
retiredPools.add(pool);
if(localPool===pool){localPool=null;localPoolSize=0;}
reads++;
const data=await raster.readRasters({window:[win.x0,win.y0,win.x0+win.w,win.y0+win.h],samples:[0],signal});
pixels=data[0];
}
const entry={pixels,w:win.w,h:win.h,x0:win.x0,y0:win.y0};
matrixBytes+=pixels.byteLength;
touch(store,group.key,entry,source);
return entry;
}catch(err){if(signal.aborted||err.name==='AbortError')throw err;error=err;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,250));}
}
throw error;
}
function sampleTile(tile,p){
if(!tile)return null;
const px=Math.max(0,Math.min(tile.w-1,Math.floor(p.fx*tile.w)));
const py=Math.max(0,Math.min(tile.h-1,Math.floor(p.fy*tile.h)));
const i=(py*tile.w+px)*4;
const data=tile.data;
if(data[i+3]===0)return null;
const value=data[i]*65536+data[i+1]*256+data[i+2];
return value===0?null:-10000+value/10;
}
function sampleCOG(block,group,p){const value=block.pixels[(p.py-block.y0)*block.w+(p.px-block.x0)];return value===-32767||value===undefined?null:value;}
function parseEle(value){if(typeof value!=='string')return null;const clean=value.trim().replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean))return null;const n=Number(clean);return Number.isFinite(n)?n:null;}
function escapeSQL(value){return String(value).replace(/'/g,"''");}
function getFilters(){const filters=[];for(const row of document.querySelectorAll('.filter-row')){const key=row.querySelector('.filter-key').value.trim();const operation=row.querySelector('.filter-operation').value;const value=row.querySelector('.filter-value').value;if(!key)throw Error('Introduce la clave de todas las condiciones o elimina la fila vacía.');if(!/^[A-Za-z0-9_:.-]{1,128}$/.test(key))throw Error(`Clave no válida: ${key}. Usa letras, números, _, :, . o -.`);if(key==='ele')throw Error('ele=* ya es obligatorio; no añadas una segunda condición ele.');if(operation==='equal'&&!value.length)throw Error(`Introduce el valor del filtro ${key} o utiliza «Existe (*)».`);filters.push({key,operation,value:operation==='equal'?value:''});}return filters;}
function filterDescription(filters){return ['ele=*',...filters.map(f=>f.operation==='exists'?`${f.key}=*`:`${f.key}=${f.value}`)].join('  ∧  ');}
function updateFilterSummary(){try{const filters=getFilters();$('filterSummary').textContent=filterDescription(filters);}catch(e){$('filterSummary').textContent=e.message;}}
function saveFilters(){const values=Array.from(document.querySelectorAll('.filter-row'),row=>({key:row.querySelector('.filter-key').value,operation:row.querySelector('.filter-operation').value,value:row.querySelector('.filter-value').value}));try{localStorage.setItem(filterSettingsKey,JSON.stringify(values));}catch(e){}updateFilterSummary();}
function addFilter(config={}){const row=document.createElement('div');row.className='filter-row';const key=document.createElement('input');key.type='text';key.className='filter-key';key.placeholder='natural';key.setAttribute('aria-label','Clave de la etiqueta');key.maxLength=128;key.value=config.key||'';const op=document.createElement('select');op.className='filter-operation';op.setAttribute('aria-label','Condición');for(const [value,label] of [['exists','Existe (*)'],['equal','Igual a (=)']]){const option=document.createElement('option');option.value=value;option.textContent=label;op.append(option);}op.value=config.operation==='equal'?'equal':'exists';const value=document.createElement('input');value.type='text';value.className='filter-value';value.placeholder='peak';value.maxLength=256;value.setAttribute('aria-label','Valor de la etiqueta');value.value=config.value||'';value.hidden=op.value!=='equal';const remove=document.createElement('button');remove.type='button';remove.className='secondary filter-remove';remove.textContent='×';remove.title='Eliminar condición';remove.setAttribute('aria-label','Eliminar condición');row.append(key,op,value,remove);$('filters').append(row);for(const field of [key,value])field.addEventListener('input',saveFilters);op.addEventListener('change',()=>{value.hidden=op.value!=='equal';saveFilters();});remove.addEventListener('click',()=>{row.remove();saveFilters();});updateFilterSummary();return key;}
$('addFilter').addEventListener('click',()=>{const key=addFilter();saveFilters();key.focus();});
try{const saved=JSON.parse(localStorage.getItem(filterSettingsKey));if(Array.isArray(saved))for(const f of saved.slice(0,20))addFilter(f);}catch(e){}updateFilterSummary();
async function fetchPostpass(bbox,signal,filters){const [w,s,e,n]=bbox;const clauses=filters.map(f=>f.operation==='exists'?`tags ? '${escapeSQL(f.key)}'`:`tags->>'${escapeSQL(f.key)}' = '${escapeSQL(f.value)}'`);const sql=`SELECT DISTINCT ON (osm_type,osm_id) osm_type,osm_id,tags->>'ele' AS ele,ST_PointOnSurface(geom) AS geom FROM postpass_pointlinepolygon WHERE tags ? 'ele' ${clauses.map(c=>`AND ${c}`).join(' ')} AND geom && ST_MakeEnvelope(${w},${s},${e},${n},4326) ORDER BY osm_type,osm_id`;const response=await fetch(postpass,{method:'POST',body:new URLSearchParams({data:sql}),signal});if(!response.ok)throw Error(`Postpass HTTP ${response.status}`);const data=await response.json();if(!Array.isArray(data.features))throw Error('Postpass no devolvió GeoJSON válido');return data.features;}
function setBusy(state){busy=state;$('analyze').disabled=state;$('analyzeItem').disabled=state;$('nearbyToggle').disabled=state;$('source').disabled=state;$('openSettings').disabled=state;for(const tab of document.querySelectorAll('[data-tool]'))tab.disabled=state;for(const section of document.querySelectorAll('.mode-settings'))for(const field of section.querySelectorAll('select,input,button'))field.disabled=state;$('cancel').hidden=!(state&&currentTool==='qa');$('cancelItem').hidden=!(state&&currentTool==='item');}
async function analyze(){
if(busy)return;
if(compactLayout.matches)displayTools(false);
if(!coverage.length){status('La cobertura MDT05 todavía no está disponible.');return;}
const extent=map.getView().calculateExtent(map.getSize());
const bbox=transformExtent(extent,'EPSG:3857','EPSG:4326');
const box=[Math.max(bbox[0],validExtent[0]),Math.max(bbox[1],validExtent[1]),Math.min(bbox[2],validExtent[2]),Math.min(bbox[3],validExtent[3])];
if(box[0]>=box[2]||box[1]>=box[3]){status('La zona visible queda fuera de la extensión MDT05.');return;}
const source=$('source').value;
let filters;
try{filters=getFilters();}catch(err){status(err.message);return;}
if(source==='local'&&!localFile){status('Selecciona un GeoTIFF local antes de analizar.');openSettings();return;}
setBusy(true);
resetAnalysis();
const abort=new AbortController();
currentAbort=abort;
const signal=abort.signal;
totalStarted=performance.now();
results._total=null;
results._skipped=0;
results._failed=0;
startPhase('postpass');
timingInterval=setInterval(updateTimes,250);
try{
let failed=0;
status('Consultando Postpass…');
const cacheKey=JSON.stringify([box.map(v=>v.toFixed(7)),filters]);
let all;
if(postpassCache&&postpassCache.key===cacheKey){all=postpassCache.features;postpassWasReused=true;}else{all=await fetchPostpass(box,signal,filters);postpassCache={key:cacheKey,features:all};}
finishPhase('postpass');
results._total=all.length;
startPhase('setup');
let raster=null;
if(source==='cog'){status('Abriendo índice del COG de Hugging Face…');raster=await ensureCOG();}
if(source==='local'){status('Abriendo BigTIFF local desde el disco…');raster=await ensureLocal();}
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
finishPhase('setup');
startPhase('prepare');
status(`Postpass: ${count(all.length)} elementos. Agrupando por ${source==='ign'?'teselas IGN':'bloques COG'}…`);
const candidates=[];
for(const f of all){
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const p=f.properties||{};
const coords=f.geometry?.coordinates;
if(f.geometry?.type!=='Point'||!Array.isArray(coords)||!inCoverage(coords[0],coords[1])){results._skipped++;continue;}
const osmEle=parseEle(p.ele);
if(osmEle===null){results._skipped++;continue;}
candidates.push({lon:coords[0],lat:coords[1],osmEle,id:p.osm_id,type:p.osm_type});
}
effectiveZoom=source==='ign'?chooseZoom(candidates):null;
const grouped=new Map();
let preparedCount=0;
for(const candidate of candidates){
const pos=source==='ign'?tilePosition(candidate.lat,candidate.lon,effectiveZoom):cogPosition(candidate.lat,candidate.lon,raster);
if(!checkPosition(pos,source,raster)){results._skipped++;continue;}
const key=positionKey(pos,source);
let group=grouped.get(key);
if(!group){group={key,...(source==='ign'?{tx:pos.tx,ty:pos.ty,zoom:pos.zoom}:{bx:pos.bx,by:pos.by}),points:[]};grouped.set(key,group);}
group.points.push({...candidate,...pos});
preparedCount++;
}
const groups=Array.from(grouped.values()).sort(source==='ign'?(a,b)=>a.ty-b.ty||a.tx-b.tx:(a,b)=>a.by-b.by||a.bx-b.bx);
uniqueGroups=groups.length;
finishPhase('prepare');
startPhase('mdt');
const parallel=Number($(`${source}Parallel`).value);
status(`${sourceName()}${effectiveZoom===null?'':` z${effectiveZoom}`}: ${count(preparedCount)} puntos · ${count(uniqueGroups)} unidades · ${parallel} lecturas paralelas`);
let next=0;
let done=0;
let processed=0;
const worker=async()=>{
while(next<groups.length){
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const group=groups[next++];
try{
const data=source==='ign'?await loadTile(group,signal):await loadCOGBlock(group,signal,source,raster);
for(const p of group.points){
const mdt=source==='ign'?sampleTile(data,p):sampleCOG(data,group,p);
if(mdt===null)results._skipped++;
else results.push({...p,source,mdt,diff:Math.abs(p.osmEle-mdt),signed:p.osmEle-mdt});
}
}catch(err){if(signal.aborted||err.name==='AbortError')throw err;failedGroups++;failed+=group.points.length;}
done+=group.points.length;
processed++;
if(processed%4===0||processed===groups.length){status(`${sourceName()}: ${count(done)} / ${count(preparedCount)} puntos · ${count(processed)} / ${count(uniqueGroups)} unidades · ${formatTime(performance.now()-phaseStarted)} · lecturas: ${count(reads)} · errores: ${count(failedGroups)}`);updateTimes();await new Promise(resolve=>setTimeout(resolve,0));}
}
};
const outcomes=await Promise.allSettled(Array.from({length:Math.min(parallel,groups.length)},()=>worker()));
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const rejected=outcomes.find(x=>x.status==='rejected');
if(rejected)throw rejected.reason;
results._failed=failed;
finishPhase('mdt');
startPhase('render');
for(const p of results){sortedDiffs.push(p.diff);if(p.diff>maxDifference)maxDifference=p.diff;}
sortedDiffs.sort((a,b)=>a-b);
featureSource.addFeatures(results.map(p=>new Feature({geometry:new Point(fromLonLat([p.lon,p.lat])),...p})));
finishPhase('render');
updateStats();
status(`Finalizado · ${filterDescription(filters)} · ${sourceName()}${effectiveZoom===null?'':` z${effectiveZoom}`} · ${count(results.length)} comparados · Postpass ${formatTime(timings.postpass)} · MDT ${formatTime(timings.mdt)}${failed?` · ${count(failed)} errores`:''}`);
}catch(err){status(err.name==='AbortError'?'Análisis cancelado.':`Error: ${err.message}`);}
finally{if(activePhase){timings[activePhase]=performance.now()-phaseStarted;activePhase=null;}timings.total=performance.now()-totalStarted;setBusy(false);currentAbort=null;clearInterval(timingInterval);timingInterval=null;for(const pool of retiredPools)pool.destroy().catch(()=>{});retiredPools.clear();updateTimes();updateStats();}
}
$('analyze').addEventListener('click',analyze);
$('cancel').addEventListener('click',()=>currentAbort?.abort());
$('cancelItem').addEventListener('click',()=>currentAbort?.abort());
const popup=$('popup');
function clearQaSelection(){selectedQaFeature=null;selectionSource.clear();popup.hidden=true;}
function markQaSelection(feature){selectedQaFeature=feature;const p=feature.getProperties();const kind={N:'node',W:'way',R:'relation'}[p.type]||'node';selectionSource.clear();selectionSource.addFeature(new Feature({geometry:feature.getGeometry().clone(),selectedLabel:`${kind} ${p.id}`}));}
$('popupClose').addEventListener('click',clearQaSelection);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popup.hidden)clearQaSelection();});
map.on('singleclick',event=>{
if(currentTool==='draw'){handleDrawClick(event);return;}
if(currentTool==='item'){if(nearbyEnabled){searchNearby(event.coordinate);return;}if(!itemProfile)return;let hit=false;map.forEachFeatureAtPixel(event.pixel,()=>{hit=true;return true;},{layerFilter:layer=>layer===itemLayer,hitTolerance:7});if(!hit)return;const projected=event.coordinate;let index=-1;let distance=Infinity;for(let j=0;j<itemProfile.samples.length;j++){const p=itemProfile.samples[j];const xy=fromLonLat([p.lon,p.lat]);const d=(xy[0]-projected[0])**2+(xy[1]-projected[1])**2;if(d<distance){distance=d;index=j;}}if(index>=0)selectSample(index,false);return;}
let hit=null;
map.forEachFeatureAtPixel(event.pixel,f=>{if(f.get('diff')!==undefined){hit=f;return true;}return false;},{hitTolerance:6,layerFilter:l=>l===resultLayer});
if(!hit){clearQaSelection();return;}
markQaSelection(hit);
const p=hit.getProperties();
const kind={N:'node',W:'way',R:'relation'}[p.type]||'node';
const body=$('popupBody');
body.replaceChildren();
const heading=document.createElement('strong');
heading.textContent=`${kind} ${p.id}`;
body.append(heading,document.createElement('br'));
for(const [key,value] of [['ele OSM',p.osmEle+' m'],[`MDT05 ${sources[p.source]}`,p.mdt.toFixed(1)+' m'],['Diferencia absoluta',p.diff.toFixed(2)+' m'],['ele OSM − MDT05',p.signed.toFixed(2)+' m']]){const row=document.createElement('div');row.textContent=`${key}: ${value}`;body.append(row);}
const actions=document.createElement('div');actions.className='popup-actions';for(const [label,url] of [['Ver en OSM',`https://www.openstreetmap.org/${kind}/${p.id}`],['Editar en iD',`https://www.openstreetmap.org/edit?${kind}=${p.id}`]]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}body.append(actions);
popup.hidden=false;
});
async function init(){
try{
status('Cargando cobertura del MDT05…');
const r=await fetch('./data/coverage.geojson');
if(!r.ok)throw Error('No se encuentra data/coverage.geojson');
const geojson=await r.json();
coverage=new GeoJSON().readFeatures(geojson,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
borderSource.addFeatures(coverage);
const frame=[[-24,22],[12,22],[12,49],[-24,49],[-24,22]];
const rings=[frame];
for(const f of geojson.features){const coordinates=f.geometry.coordinates;rings.push([...coordinates[0]].reverse());for(const hole of coordinates.slice(1))shadeSource.addFeature(new Feature(new Polygon([hole]).transform('EPSG:4326','EPSG:3857')));}
shadeSource.addFeature(new Feature(new Polygon(rings).transform('EPSG:4326','EPSG:3857')));
status('Listo. Elige IGN XYZ, COG remoto o COG local y pulsa «Analizar zona visible».');
}catch(err){status('Error de inicialización: '+err.message);$('analyze').disabled=true;}
}
init();
function updateNearbyToggle(){
$('nearbyToggle').textContent=nearbyEnabled?'Desactivar selección en mapa':'Seleccionar en mapa';
$('nearbyToggle').setAttribute('aria-pressed',String(nearbyEnabled));
$('nearbyToggle').classList.toggle('nearby-active',nearbyEnabled);
$('app').classList.toggle('nearby-selecting',nearbyEnabled&&currentTool==='item');
updateDrawControls();
}
function disableNearby(clearResults=false){
nearbyEnabled=false;
nearbySearchId++;
nearbyAbort?.abort();
nearbyAbort=null;
nearbyVector.clear();
if(clearResults){$('nearbyResults').replaceChildren();$('nearbyResults').hidden=true;$('nearbyStatus').textContent='Activa la búsqueda y pulsa en el mapa para encontrar nodos etiquetados y vías cercanas.';}
updateNearbyToggle();
}
function nearbyDistance(point,element){
const latitude=point.lat*Math.PI/180;
const multiplier=111195;
const xy=p=>[(p.lon-point.lon)*multiplier*Math.cos(latitude),(p.lat-point.lat)*multiplier];
const positions=element.type==='node'?[element]:element.geometry;
if(!Array.isArray(positions)||!positions.length)return Infinity;
let nearest=Infinity;
let previous=null;
for(const position of positions){if(!Number.isFinite(position.lon)||!Number.isFinite(position.lat))continue;const [x,y]=xy(position);let squared=x*x+y*y;if(previous){const dx=x-previous[0],dy=y-previous[1],length=dx*dx+dy*dy;if(length>0){const t=Math.max(0,Math.min(1,-(previous[0]*dx+previous[1]*dy)/length));const px=previous[0]+t*dx,py=previous[1]+t*dy;squared=Math.min(squared,px*px+py*py);}}nearest=Math.min(nearest,squared);previous=[x,y];}
return Math.sqrt(nearest);
}
function nearbyLabel(element){
const tags=element.tags||{};
return tags.name||tags['name:es']||tags.ref||Object.entries(tags).find(([key])=>['highway','natural','waterway','amenity','building','leisure','landuse','railway','barrier'].includes(key))?.join('=')||`${element.type==='node'?'Nodo':'Vía'} sin nombre`;
}
function renderNearby(elements,point,radius,limited){
const container=$('nearbyResults');
container.replaceChildren();
const matches=elements.filter(e=>(e.type==='node'||e.type==='way')&&Number.isSafeInteger(e.id)).map(e=>({...e,distance:nearbyDistance(point,e)})).filter(e=>Number.isFinite(e.distance)&&e.distance<=radius+2).sort((a,b)=>a.distance-b.distance||(a.type==='node'?-1:1));
const shown=matches.slice(0,35);
const heading=document.createElement('div');heading.className='nearby-heading';heading.textContent=`${matches.length} candidatos · ${radius} m${limited?' · respuesta limitada':''}`;container.append(heading);
for(const e of shown){const row=document.createElement('button');row.type='button';row.className='nearby-row';const name=document.createElement('strong');name.textContent=nearbyLabel(e);const detail=document.createElement('span');detail.textContent=`${e.type==='node'?'Nodo':'Vía'} ${e.id} · ${e.distance.toFixed(1)} m`;row.append(name,detail);row.addEventListener('click',()=>selectNearby(e));container.append(row);}
if(matches.length>shown.length){const rest=document.createElement('div');rest.className='hint';rest.textContent=`Se muestran los ${shown.length} más próximos. Acércate para reducir la lista.`;container.append(rest);}
if(!matches.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='No se han encontrado nodos etiquetados ni vías próximos. Prueba en otro punto o amplía ligeramente el zoom.';container.append(empty);}
container.hidden=false;
$('nearbyStatus').textContent=`Búsqueda completada alrededor de ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}. ${matches.length} elementos cercanos.`;
if(compactLayout.matches)displayTools(true);
}
async function searchNearby(coordinate){
if(!nearbyEnabled||busy||currentTool!=='item')return;
nearbyAbort?.abort();nearbyAbort=null;nearbySearchId++;
const zoom=map.getView().getZoom();
if(zoom<14){nearbyVector.clear();$('nearbyResults').hidden=true;$('nearbyStatus').textContent='Acerca el mapa hasta el zoom 14 o superior para buscar objetos próximos.';if(compactLayout.matches)displayTools(true);return;}
const [lon,lat]=toLonLat(coordinate);
if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat>85||lat< -85)return;
const radius=Math.max(8,Math.min(45,Math.round(14*map.getView().getResolution()*Math.cos(lat*Math.PI/180))));
const controller=new AbortController();nearbyAbort=controller;
const request=++nearbySearchId;
nearbyVector.clear();nearbyVector.addFeature(new Feature({geometry:new Point(coordinate)}));
$('nearbyResults').hidden=true;
$('nearbyStatus').textContent=`Buscando nodos y vías a ${radius} m…`;
const query=`[out:json][timeout:25][maxsize:32Mi];(node(around:${radius},${lat.toFixed(7)},${lon.toFixed(7)})(if:count_tags()>0);way(around:${radius},${lat.toFixed(7)},${lon.toFixed(7)}););out body geom 400;`;
try{
const response=await fetch(nearbyEndpoint,{method:'POST',body:new URLSearchParams({data:query}),signal:controller.signal});
if(!response.ok)throw Error(`Overpass HTTP ${response.status}`);
const data=await response.json();
if(!Array.isArray(data.elements))throw Error('Overpass no devolvió una lista válida de elementos.');
if(request!==nearbySearchId||!nearbyEnabled||currentTool!=='item')return;
renderNearby(data.elements,{lat,lon},radius,data.elements.length>=400);
}catch(error){if(controller.signal.aborted||request!==nearbySearchId)return;$('nearbyStatus').textContent=`No se pudo buscar: ${error.message}`;if(compactLayout.matches)displayTools(true);}
finally{if(nearbyAbort===controller)nearbyAbort=null;}
}
function selectNearby(element){
if(busy)return;
disableNearby(false);
$('idType').value=element.type;
$('osmIdInput').value=String(element.id);
$('wayOptions').hidden=element.type!=='way';
$('loadHistory').checked=false;
$('versionRow').hidden=true;
$('versionSelector').replaceChildren(new Option('Última versión','latest'));
$('versionSelector').disabled=true;
$('nearbyStatus').textContent=`Seleccionado: ${element.type==='node'?'nodo':'vía'} ${element.id}. Consultando su elevación…`;
analyzeItem();
}
$('nearbyToggle').addEventListener('click',()=>{if(busy)return;if(nearbyEnabled){disableNearby(false);$('nearbyStatus').textContent='Selección desde el mapa desactivada.';}else{nearbyEnabled=true;$('nearbyStatus').textContent='Pulsa en el mapa para buscar nodos etiquetados y vías próximos. Zoom mínimo: 14.';updateNearbyToggle();if(compactLayout.matches)displayTools(false);}});
function clearItem(){itemProfile=null;activeSampleStyle=null;itemVector.clear();$('resultsPanel').classList.remove('profile-open');$('profileResults').hidden=true;$('itemSummary').replaceChildren(document.createTextNode('Consulta un nodo o una vía para mostrar sus elevaciones.'));$('elevationChart').replaceChildren();$('selectedSample').textContent='Selecciona un punto para ver sus datos.';}
function apiUrl(kind,id,version='latest'){return `https://www.openstreetmap.org/api/0.6/${kind}/${id}${version==='latest'?'':`/${version}`}.json`;}
async function loadOSM(kind,id,version,signal){
if(kind==='way'&&version==='latest'){
const response=await fetch(`https://www.openstreetmap.org/api/0.6/way/${id}/full.json`,{signal});
if(!response.ok)throw Error(`API OSM: HTTP ${response.status}`);
const data=await response.json();
const way=data.elements?.find(e=>e.type==='way'&&String(e.id)===id);
if(!way)throw Error('La vía no aparece en la respuesta de OSM.');
const nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
const samples=way.nodes.map(n=>nodes.get(n));
if(samples.some(n=>!n||!Number.isFinite(n.lat)||!Number.isFinite(n.lon)))throw Error('La respuesta de OSM no contiene todos los nodos de la vía.');
return {object:way,samples};
}
if(kind==='way'){
const query=`[out:json][timeout:120][maxsize:32Mi];timeline(way,${id});foreach(retro(u(t["created"]))(way(${id});out geom meta;););`;
const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal});
if(!response.ok)throw Error(`Overpass histórico: HTTP ${response.status}`);
const data=await response.json();
const way=data.elements?.find(e=>e.type==='way'&&String(e.version)===version);
if(!way?.geometry?.length)throw Error('Overpass no devolvió la geometría de esa versión histórica.');
const samples=way.geometry.map((node,i)=>({lat:node.lat,lon:node.lon,id:way.nodes?.[i]??null}));
return {object:way,samples};
}
const response=await fetch(apiUrl('node',id,version),{signal});
if(!response.ok)throw Error(`API OSM: HTTP ${response.status}`);
const data=await response.json();
const node=data.elements?.find(e=>e.type==='node'&&String(e.id)===id);
if(!node||!Number.isFinite(node.lat)||!Number.isFinite(node.lon))throw Error('No se han encontrado coordenadas para ese nodo.');
return {object:node,samples:[node]};
}
async function loadVersions(){
const kind=$('idType').value;
const id=$('osmIdInput').value.trim();
const selector=$('versionSelector');
selector.replaceChildren(new Option('Última versión','latest'));
selector.disabled=true;
if(!/^[1-9][0-9]{0,18}$/.test(id)){$('historyStatus').textContent='Introduce primero un ID OSM válido.';return;}
$('historyStatus').textContent='Consultando versiones de OSM…';
try{
const response=await fetch(`https://www.openstreetmap.org/api/0.6/${kind}/${id}/history`);
if(!response.ok)throw Error(`HTTP ${response.status}`);
const xml=new DOMParser().parseFromString(await response.text(),'application/xml');
if(xml.querySelector('parsererror'))throw Error('La respuesta del historial no es XML válido.');
const versions=Array.from(xml.getElementsByTagName(kind)).map(el=>({v:el.getAttribute('version'),date:el.getAttribute('timestamp')})).filter(v=>/^[1-9]\d*$/.test(v.v)).reverse();
for(const item of versions)selector.add(new Option(`v${item.v} · ${item.date||'sin fecha'}`,item.v));
selector.disabled=false;
$('historyStatus').textContent=`${versions.length} versiones disponibles.${kind==='way'?' La geometría histórica requiere Overpass y puede tardar.':''}`;
}catch(err){$('historyStatus').textContent=`No se pudo obtener el historial: ${err.message}`;}
}
$('loadHistory').addEventListener('change',()=>{$('versionRow').hidden=!$('loadHistory').checked;if($('loadHistory').checked)loadVersions();else{$('versionSelector').value='latest';$('versionSelector').disabled=true;}});
$('idType').addEventListener('change',()=>{$('wayOptions').hidden=$('idType').value!=='way';if($('loadHistory').checked)loadVersions();});
$('osmIdInput').addEventListener('change',()=>{if($('loadHistory').checked)loadVersions();});
$('xScale').addEventListener('change',()=>{if(currentTool==='item'&&itemProfile?.samples.length>1)drawProfile();});
const earthRadius=6371000;
function distanceMeters(a,b){const rad=Math.PI/180;const dLat=(b.lat-a.lat)*rad;const dLon=(b.lon-a.lon)*rad;const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;return 2*earthRadius*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function sampleWay(nodes){
if(nodes.length<2)throw Error('La vía no contiene suficientes nodos para calcular pendientes.');
if(nodes.length>5000)throw Error(`Esta vía tiene ${count(nodes.length)} nodos. Se admiten hasta 5.000 nodos para representar el perfil.`);
return nodes.map(n=>({lat:n.lat,lon:n.lon,id:n.id}));
}
async function queryTerrain(points,source,signal,onProgress){
let raster=null;
if(source==='local')raster=await ensureLocal();
if(source==='cog')raster=await ensureCOG();
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const valid=[];
const heights=Array(points.length).fill(null);
const states=Array(points.length).fill('outside');
for(let index=0;index<points.length;index++){
const p=points[index];
if(Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&inCoverage(p.lon,p.lat)){valid.push({...p,index});states[index]='nodata';}
}
const zoom=source==='ign'?chooseZoom(valid):null;
const groups=new Map();
for(const p of valid){
const pos=source==='ign'?tilePosition(p.lat,p.lon,zoom):cogPosition(p.lat,p.lon,raster);
if(!checkPosition(pos,source,raster))continue;
const key=positionKey(pos,source);
let group=groups.get(key);
if(!group){group={key,...(source==='ign'?{tx:pos.tx,ty:pos.ty,zoom:pos.zoom}:{bx:pos.bx,by:pos.by}),points:[]};groups.set(key,group);}
group.points.push({...p,...pos});
}
const units=Array.from(groups.values()).sort(source==='ign'?(a,b)=>a.ty-b.ty||a.tx-b.tx:(a,b)=>a.by-b.by||a.bx-b.bx);
let next=0;
let completed=0;
let failures=0;
const limit=Math.min(Number($(`${source}Parallel`).value),units.length);
const worker=async()=>{
while(next<units.length){
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const group=units[next++];
try{
const tile=source==='ign'?await loadTile(group,signal):await loadCOGBlock(group,signal,source,raster);
for(const p of group.points){const value=source==='ign'?sampleTile(tile,p):sampleCOG(tile,group,p);heights[p.index]=value;states[p.index]=value===null?'nodata':'ok';}
}catch(err){if(signal.aborted||err.name==='AbortError')throw err;failures++;for(const p of group.points)states[p.index]='error';}
completed++;
if(completed%4===0||completed===units.length){onProgress?.(completed,units.length,failures);await new Promise(resolve=>setTimeout(resolve,0));}
}
};
const outcomes=await Promise.allSettled(Array.from({length:limit},()=>worker()));
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const rejected=outcomes.find(o=>o.status==='rejected');
if(rejected)throw rejected.reason;
return {heights,states,failures,zoom,units:units.length};
}
function formatHeight(h){return h==null?'Sin dato':`${Number(h).toLocaleString('es-ES',{maximumFractionDigits:1})} m`;}
function itemCard(label,value){const box=document.createElement('div');box.className='value';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=value;box.append(a,b);return box;}
function renderItemSummary(type,id,version,object,terrain,detail){
const container=$('itemSummary');
container.replaceChildren();
container.append(itemCard('Elemento',`${type==='node'?'Nodo':'Vía'} ${id}${version==='latest'?'':` · v${version}`}`));
if(type==='node'){
const ele=parseEle(object.tags?.ele);
const mdt=terrain.heights[0];
container.append(itemCard('ele=* en OSM',ele==null?'No definido / inválido':formatHeight(ele)),itemCard(`MDT05 ${sourceName()}`,formatHeight(mdt)),itemCard('ele OSM − MDT05',ele!=null&&mdt!=null?formatHeight(ele-mdt):'—'));
}else container.append(itemCard('Nodos OSM',count(detail.nodes)),itemCard('Elevaciones válidas',count(terrain.heights.filter(Number.isFinite).length)),itemCard('Distancia',`${(detail.distance/1000).toLocaleString('es-ES',{maximumFractionDigits:2})} km`),itemCard('Fuente del MDT',sourceName()));
const link=document.createElement('a');link.href=`https://www.openstreetmap.org/${type}/${id}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Ver en OSM ↗';container.append(link);
}
function drawItemOnMap(type,samples){
itemVector.clear();
if(type==='node'){
itemVector.addFeature(new Feature({geometry:new Point(fromLonLat([samples[0].lon,samples[0].lat])),itemKind:'endpoint'}));
map.getView().animate({center:fromLonLat([samples[0].lon,samples[0].lat]),zoom:Math.max(14,map.getView().getZoom()),duration:300});
return;
}
const coords=samples.map(n=>fromLonLat([n.lon,n.lat]));
const path=new Feature({geometry:new LineString(coords),itemKind:'line'});
itemVector.addFeature(path);
itemVector.addFeature(new Feature({geometry:new Point(coords[0]),itemKind:'endpoint'}));
itemVector.addFeature(new Feature({geometry:new Point(coords.at(-1)),itemKind:'endpoint'}));
map.getView().fit(path.getGeometry().getExtent(),{padding:[40,50,40,50],duration:300,maxZoom:17});
}
function makeSvg(tag,attrs={},text=''){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [name,value] of Object.entries(attrs))el.setAttribute(name,String(value));if(text)el.textContent=text;return el;}
function drawProfile(){
if(!itemProfile)return;
const {samples,heights,distances}=itemProfile;
const svg=$('elevationChart');svg.replaceChildren();
const width=Math.max(400,Math.min(1600,230*svg.clientWidth/Math.max(1,svg.clientHeight)));
svg.setAttribute('viewBox',`0 0 ${width.toFixed(3)} 230`);
const plotLeft=50,plotRight=width-25,plotWidth=plotRight-plotLeft;
const valid=heights.filter(Number.isFinite);
if(!valid.length){svg.append(makeSvg('text',{x:width/2,y:115,fill:'#d6e8d9','text-anchor':'middle'},'Sin elevaciones válidas dentro de la cobertura MDT05'));return;}
const min=Math.min(...valid),max=Math.max(...valid);
const yMin=min===max?min-1:min-(max-min)*.08;
const yMax=min===max?max+1:max+(max-min)*.08;
const scale=currentTool==='draw'||$('xScale').checked;
const domain=scale?distances:samples.map((_,index)=>index);
const xmax=domain.at(-1)||1;
const X=value=>plotLeft+value/xmax*plotWidth;
const Y=value=>190-(value-yMin)/(yMax-yMin)*163;
for(let i=0;i<=4;i++){
const yy=190-i*163/4;
svg.append(makeSvg('line',{x1:plotLeft,y1:yy,x2:plotRight,y2:yy,stroke:'#335742','stroke-width':1}));
svg.append(makeSvg('text',{x:43,y:yy+4,fill:'#a5bcad','text-anchor':'end','font-size':12},`${(yMin+(yMax-yMin)*i/4).toFixed(yMax-yMin<10?1:0)}`));
const xx=plotLeft+i*plotWidth/4;
svg.append(makeSvg('text',{x:xx,y:215,fill:'#a5bcad','text-anchor':'middle','font-size':12},scale?`${(xmax*i/4000).toFixed(xmax<1000?2:1)} km`:`${Math.round(xmax*i/4)}`));
}
let d='';
for(let i=0;i<samples.length;i++){const h=heights[i];if(h==null){d+=' ';continue;}const prior=heights[i-1];d+=`${prior==null||i===0?'M':'L'}${X(domain[i]).toFixed(2)},${Y(h).toFixed(2)} `;}
svg.append(makeSvg('path',{d,stroke:'#96e1ad','stroke-width':2.2,fill:'none','stroke-linejoin':'round'}));
const selected=Math.min(activeSample,samples.length-1);
if(heights[selected]!=null){const x=X(domain[selected]),y=Y(heights[selected]);svg.append(makeSvg('line',{x1:x,y1:24,x2:x,y2:190,stroke:'#ffc26b','stroke-dasharray':'5 4'}));svg.append(makeSvg('circle',{cx:x,cy:y,r:6,fill:'#ffc26b',stroke:'#102018','stroke-width':2}));}
const overlay=makeSvg('rect',{x:plotLeft,y:18,width:plotWidth,height:180,fill:'transparent',role:'button','aria-label':'Selecciona un punto del perfil'});
overlay.addEventListener('click',event=>{const transform=svg.getScreenCTM();if(!transform)return;const pointer=svg.createSVGPoint();pointer.x=event.clientX;pointer.y=event.clientY;const svgX=pointer.matrixTransform(transform.inverse()).x;const value=Math.max(0,Math.min(1,(svgX-plotLeft)/plotWidth))*xmax;let low=0,high=domain.length-1;while(low<high){const mid=Math.floor((low+high)/2);if(domain[mid]<value)low=mid+1;else high=mid;}const nearest=low>0&&Math.abs(domain[low-1]-value)<Math.abs(domain[low]-value)?low-1:low;selectSample(nearest,true);});
svg.append(overlay);
}
function selectSample(index,center){
if(!itemProfile)return;
activeSample=Math.max(0,Math.min(itemProfile.samples.length-1,index));
const {samples,heights,distances}=itemProfile;
const p=samples[activeSample];
const profileVector=currentTool==='draw'?drawVector:itemVector;
if(currentTool==='draw'){for(const feature of drawVector.getFeatures())if(feature.get('drawKind')==='vertex')feature.set('drawSelected',feature.get('drawIndex')===activeSample);activeSampleStyle=null;}else{if(activeSampleStyle)profileVector.removeFeature(activeSampleStyle);activeSampleStyle=new Feature({geometry:new Point(fromLonLat([p.lon,p.lat])),itemKind:'active'});profileVector.addFeature(activeSampleStyle);}
$('selectedSample').replaceChildren();
const link=p.id?document.createElement('a'):null;
$('selectedSample').append(document.createTextNode(`${currentTool==='draw'?'Vértice':'Muestra'} ${count(activeSample+1)}/${count(samples.length)} · Distancia ${(distances[activeSample]/1000).toFixed(3)} km · MDT05: ${formatHeight(heights[activeSample])} · ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} `));
if(currentTool==='draw')selectedDraw=activeSample;
if(link){link.href=`https://www.openstreetmap.org/node/${p.id}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`· Nodo ${p.id} ↗`;$('selectedSample').append(link);}
if(center)map.getView().animate({center:fromLonLat([p.lon,p.lat]),duration:250});
drawProfile();
}
$('elevationChart').addEventListener('keydown',event=>{if(!itemProfile)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();selectSample(activeSample+(event.key==='ArrowRight'?1:-1),true);}});
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(itemProfile&&!$('profileResults').hidden)drawProfile();}).observe($('elevationChart'));
function showProfile(samples,heights,selected=0){
const distances=[0];
for(let i=1;i<samples.length;i++)distances.push(distances[i-1]+distanceMeters(samples[i-1],samples[i]));
itemProfile={samples,heights,distances};
activeSample=Math.max(0,Math.min(samples.length-1,selected));
const slopes=[];
for(let i=1;i<samples.length;i++)if(heights[i]!=null&&heights[i-1]!=null){const distance=distances[i]-distances[i-1];if(distance>.01)slopes.push((heights[i]-heights[i-1])/distance*100);}
const heightsValid=heights.filter(Number.isFinite);
const start=heights[0],end=heights.at(-1);
const maxSlope=slopes.length?slopes.reduce((best,s)=>Math.abs(s)>Math.abs(best)?s:best,slopes[0]):null;
const meanSlope=slopes.length?slopes.reduce((sum,s)=>sum+s,0)/slopes.length:null;
const stats=[['Inicio',formatHeight(start)],['Fin',formatHeight(end)],['Diferencia',start!=null&&end!=null?formatHeight(end-start):'—'],['Máximo',heightsValid.length?formatHeight(Math.max(...heightsValid)):'—'],['Mínimo',heightsValid.length?formatHeight(Math.min(...heightsValid)):'—'],['Distancia total',`${(distances.at(-1)/1000).toLocaleString('es-ES',{maximumFractionDigits:3})} km`],['Pendiente máxima (absoluta)',maxSlope===null?'—':`${maxSlope.toFixed(1)} %`],['Pendiente media de tramos',meanSlope===null?'—':`${meanSlope.toFixed(1)} %`]];
const target=$('profileStats');target.replaceChildren();
for(const [name,value] of stats){const row=document.createElement('div');row.className='stat';const a=document.createElement('span');a.textContent=name;const b=document.createElement('strong');b.textContent=value;row.append(a,b);target.append(row);}
$('profileResults').hidden=false;
$('resultsPanel').classList.add('profile-open');
updateMapSize();
selectSample(activeSample,false);
}
function updateDrawControls(){
$('drawActivate').textContent=drawingEnabled?'Pausar dibujo':drawPoints.length?'Reanudar dibujo':'Activar dibujo';
$('drawActivate').setAttribute('aria-pressed',String(drawingEnabled));
$('drawActivate').classList.toggle('drawing-on',drawingEnabled);
$('drawFinish').disabled=!drawingEnabled;
$('drawUndo').disabled=!drawPoints.length;
$('drawClear').disabled=!drawPoints.length;
$('app').classList.toggle('drawing-active',currentTool==='draw'&&drawingEnabled);
const last=drawPoints.at(-1);const lastHeight=last?(last.state==='pending'?'calculando…':last.state==='error'?'error MDT':formatHeight(last.height)):null;
$('mapNote').textContent=currentTool==='qa'?'Selecciona una zona y pulsa «Analizar zona visible»':currentTool==='item'?(nearbyEnabled?'Buscar OSM · pulsa en el mapa': 'Selecciona en mapa o consulta un ID'):last?`${drawingEnabled?'Dibujando':'Pausado'} · Punto ${drawPoints.length}: ${lastHeight} · Perfil en Resultados`:drawingEnabled?'Dibujo activo · pulsa en el mapa para añadir vértices':'Activa el dibujo para consultar elevaciones en el mapa';
}
function clearDraw(){
for(const point of drawPoints)point.request?.abort();
drawPoints=[];
drawingEnabled=false;
selectedDraw=0;
drawVector.clear();
if(currentTool==='draw')renderDraw();
updateDrawControls();
}
function renderDraw(){
if(currentTool!=='draw')return;
drawVector.clear();
activeSampleStyle=null;
const summary=$('itemSummary');
summary.replaceChildren();
const n=drawPoints.length;
if(!n){summary.textContent='Activa el dibujo y pulsa sobre el mapa para consultar una elevación.';$('profileResults').hidden=true;$('resultsPanel').classList.remove('profile-open');itemProfile=null;$('elevationChart').replaceChildren();$('drawStatus').textContent='Sin puntos. Activa el dibujo para comenzar.';updateDrawControls();return;}
const coords=drawPoints.map(p=>fromLonLat([p.lon,p.lat]));
if(coords.length>1)drawVector.addFeature(new Feature({geometry:new LineString(coords),drawKind:'line'}));
for(let i=0;i<coords.length;i++)drawVector.addFeature(new Feature({geometry:new Point(coords[i]),drawKind:'vertex',drawIndex:i,drawSelected:i===selectedDraw}));
const last=drawPoints.at(-1);
const pending=drawPoints.filter(p=>p.state==='pending').length;
const errors=drawPoints.filter(p=>p.state==='error').length;
summary.append(itemCard('Vértices',count(n)),itemCard('Fuente de terreno',sourceName()),itemCard('Último punto',`${last.lat.toFixed(6)}, ${last.lon.toFixed(6)}`),itemCard('Elevación del último punto',last.state==='pending'?'Consultando…':last.state==='error'?'Error de lectura':formatHeight(last.height)));
if(n>1){$('profileHint').textContent='Pulsa el gráfico para identificar el vértice más cercano en el mapa.';showProfile(drawPoints,drawPoints.map(p=>p.height),selectedDraw);}
else{$('profileResults').hidden=true;$('resultsPanel').classList.remove('profile-open');itemProfile=null;}
$('drawStatus').textContent=`${count(n)} ${n===1?'punto':'puntos'} · ${count(n-pending-errors)} consultados · ${count(pending)} pendientes${errors?` · ${count(errors)} errores`:''} · ${drawingEnabled?'Dibujo activo':'Dibujo pausado'}`;
updateDrawControls();
}
function addDrawPoint(lat,lon){
if(drawPoints.length>=500){$('drawStatus').textContent='Máximo de 500 vértices por perfil.';return;}
const source=$('source').value;
if(source==='local'&&!localFile){drawingEnabled=false;updateDrawControls();$('drawStatus').textContent='Selecciona primero el archivo MDT05 local en Ajustes.';openSettings();return;}
const point={lat,lon,height:null,state:'pending',request:new AbortController()};
drawPoints.push(point);
selectedDraw=drawPoints.length-1;
if(drawPoints.length===1&&!compactLayout.matches){desktopResultsOpen=true;displayResults(true);}
renderDraw();
queryTerrain([point],source,point.request.signal).then(result=>{if(point.request.signal.aborted||!drawPoints.includes(point))return;point.height=result.heights[0];point.state=result.states[0];renderDraw();}).catch(error=>{if(point.request.signal.aborted||!drawPoints.includes(point))return;point.state='error';point.height=null;$('drawStatus').textContent=`Error al consultar terreno: ${error.message}`;renderDraw();});
}
function handleDrawClick(event){
if(busy)return;
const hit=map.forEachFeatureAtPixel(event.pixel,feature=>feature.get('drawKind')==='vertex'?feature:null,{layerFilter:layer=>layer===drawLayer,hitTolerance:8});
if(hit){const index=hit.get('drawIndex');selectedDraw=index;if(itemProfile)selectSample(index,false);else renderDraw();return;}
if(!drawingEnabled)return;
const [lon,lat]=toLonLat(event.coordinate);
if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
addDrawPoint(lat,lon);
}
$('drawActivate').addEventListener('click',()=>{if(busy)return;if($('source').value==='local'&&!localFile){$('drawStatus').textContent='Selecciona primero el archivo MDT05 local en Ajustes.';openSettings();return;}drawingEnabled=!drawingEnabled;updateDrawControls();if(currentTool==='draw'&&drawingEnabled&&compactLayout.matches)displayTools(false);renderDraw();});
$('drawFinish').addEventListener('click',()=>{drawingEnabled=false;updateDrawControls();renderDraw();});
$('drawUndo').addEventListener('click',()=>{if(!drawPoints.length)return;drawPoints.pop().request?.abort();selectedDraw=Math.max(0,drawPoints.length-1);renderDraw();});
$('drawClear').addEventListener('click',clearDraw);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&currentTool==='draw'&&drawingEnabled){drawingEnabled=false;updateDrawControls();renderDraw();}});
async function analyzeItem(){
if(busy)return;
if(nearbyEnabled)disableNearby(false);
if(compactLayout.matches)displayTools(false);
const kind=$('idType').value;
const id=$('osmIdInput').value.trim();
if(!/^[1-9][0-9]{0,18}$/.test(id)){itemStatus('Introduce un ID OSM numérico positivo (hasta 19 cifras).');return;}
const source=$('source').value;
if(source==='local'&&!localFile){itemStatus('Selecciona primero tu archivo COG local en ⚙ Ajustes.');openSettings();return;}
const version=$('loadHistory').checked?$('versionSelector').value:'latest';
setBusy(true);
clearItem();
const abort=new AbortController();
currentAbort=abort;
const signal=abort.signal;
const started=performance.now();
try{
itemStatus(`Cargando ${kind==='node'?'nodo':'vía'} ${id} de OSM…`);
const data=await loadOSM(kind,id,version,signal);
const samples=kind==='node'?data.samples:sampleWay(data.samples);
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
itemStatus(`${count(samples.length)} puntos. Consultando ${sourceName()}…`);
const terrain=await queryTerrain(samples,source,signal,(done,total,fail)=>itemStatus(`Leyendo MDT05: ${count(done)}/${count(total)} unidades${fail?` · ${fail} errores`:''}…`));
if(signal.aborted)throw new DOMException('Cancelado','AbortError');
const totalDistance=kind==='node'?0: samples.reduce((sum,p,i)=>i?sum+distanceMeters(samples[i-1],p):sum,0);
renderItemSummary(kind,id,version,data.object,terrain,{nodes:data.samples.length,samples:samples.length,distance:totalDistance});
drawItemOnMap(kind,samples);
if(kind==='way')showProfile(samples,terrain.heights);
itemStatus(`Listo · ${count(terrain.heights.filter(Number.isFinite).length)}/${count(samples.length)} cotas MDT05 · ${formatTime(performance.now()-started)} · ${terrain.units} unidades · ${terrain.failures} errores.`);
}catch(err){itemStatus(err.name==='AbortError'?'Consulta cancelada.':`Error: ${err.message}`);}
finally{setBusy(false);currentAbort=null;}
}
$('analyzeItem').addEventListener('click',analyzeItem);
$('osmIdInput').addEventListener('keydown',event=>{if(event.key==='Enter')analyzeItem();});
selectTool('qa');
updateDrawControls();
