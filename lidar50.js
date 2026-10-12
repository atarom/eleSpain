import {mtn50At} from './mtn50-grid.js';
const cnigCatalog='https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt50cm';
const knownSheets={'11-21-6-8':{number:'0526',filename:'MDT50CM-ETRS89-H29-0526-6-8-COB3-V1.tif',url:'https://centrodedescargas.cnig.es/CentroDescargas/detalleArchivo?sec=12765688'}};
let loadingProj4=null;
let lastFile=null;
let lastImage=null;
let lastCoverageFile=null;
export function lidarSheet(lon,lat){
const position=mtn50At(lon,lat);
if(!position)return null;
const {number,column,row}=position;
if(column===null||row===null)return {number,column:null,row:null,subColumn:null,subRow:null,known:null,key:null};
const westOrigin=-9-51/60-15/3600;
const west=westOrigin+(column-1)/3;
const north=44-(row-1)/6;
const subColumn=Math.max(1,Math.min(8,Math.floor((lon-west)*24)+1));
const subRow=Math.max(1,Math.min(8,Math.floor((north-lat)*48)+1));
const key=`${column}-${row}-${subColumn}-${subRow}`;
return {number,column,row,subColumn,subRow,key,known:knownSheets[key]||null};
}
async function ensureProj4(){
if(window.proj4)return window.proj4;
if(!loadingProj4)loadingProj4=new Promise((resolve,reject)=>{
const script=document.createElement('script');
script.src='https://cdn.jsdelivr.net/npm/proj4@2.22.0/dist/proj4.js';
script.onload=()=>window.proj4?resolve(window.proj4):reject(Error('La biblioteca de proyecciones no está disponible.'));
script.onerror=()=>reject(Error('No se pudo cargar proj4.js.'));
document.head.append(script);
}).catch(error=>{loadingProj4=null;throw error;});
return loadingProj4;
}
function utmZone(image){
const keys=image.getGeoKeys();
const epsg=Number(keys.ProjectedCSTypeGeoKey);
if(epsg>=3040&&epsg<=3043)return epsg-3012;
if(epsg>=25828&&epsg<=25831)return epsg-25800;
if(epsg===4083||epsg===32628)return 28;
if(epsg>=32629&&epsg<=32631)return epsg-32600;
throw Error(`Proyección del GeoTIFF no admitida (EPSG:${Number.isFinite(epsg)?epsg:'desconocido'}).`);
}
async function openLidar(file,ensureGeoTiff){
if(!/\.tiff?$/i.test(file.name))throw Error('Selecciona un archivo GeoTIFF (.tif).');
if(!/^MDT50CM[-_]/i.test(file.name)||!/COB3/i.test(file.name))throw Error('Selecciona un MDT50cm de la tercera cobertura del CNIG.');
await Promise.all([ensureGeoTiff(),ensureProj4()]);
if(lastFile!==file||!lastImage){
const tiff=await window.GeoTIFF.fromBlob(file);
lastImage=await tiff.getImage();
lastFile=file;
}
return lastImage;
}
function projection(image){
return `+proj=utm +zone=${utmZone(image)} +ellps=GRS80 +units=m +no_defs`;
}
function footprint(image){
const [west,south,east,north]=image.getBoundingBox();
if(![west,south,east,north].every(Number.isFinite)||west>=east||south>=north)throw Error('Extensión geográfica del TIFF no válida.');
const crs=projection(image);
return [[west,south],[east,south],[east,north],[west,north],[west,south]].map(coords=>window.proj4(crs,'EPSG:4326',coords));
}
function pixelPosition(image,lon,lat){
const coords=window.proj4('EPSG:4326',projection(image),[lon,lat]);
const [ox,oy]=image.getOrigin();
const [rx,ry]=image.getResolution();
if(!Number.isFinite(rx)||!Number.isFinite(ry)||rx===0||ry===0)throw Error('Georreferenciación del GeoTIFF no válida.');
const col=Math.floor((coords[0]-ox)/rx);
const row=Math.floor((coords[1]-oy)/ry);
if(col<0||row<0||col>=image.getWidth()||row>=image.getHeight())throw Error('El GeoTIFF seleccionado no cubre estas coordenadas.');
return {col,row};
}
async function readLidar(image,lon,lat){
const {col,row}=pixelPosition(image,lon,lat);
const raster=await image.readRasters({window:[col,row,col+1,row+1],samples:[0]});
const value=Number(raster[0][0]);
const nodataRaw=image.getGDALNoData?.();
const nodata=nodataRaw==null?NaN:Number(nodataRaw);
if(!Number.isFinite(value)||value===-32767||(Number.isFinite(nodata)&&value===nodata))return {value:null,col,row};
return {value,col,row};
}
function readName(file){
const match=file?.name?.match(/-(\d{4})-(\d)-(\d)-COB3/i);
return match?`${match[1]}-${match[2]}-${match[3]}`:null;
}
function createButton(label,action,className='lidar50-action'){
const button=document.createElement('button');
button.type='button';
button.className=className;
button.textContent=label;
button.addEventListener('click',action);
return button;
}
export function lidar50Control({lon,lat,ensureGeoTiff,osmEle=null,showCoverage,hideCoverage}){
const sheet=lidarSheet(lon,lat);
const code=sheet?.number?(sheet.subColumn!==null?`${sheet.number}-${sheet.subColumn}-${sheet.subRow}`:sheet.number):null;
const section=document.createElement('section');
section.className='lidar50-panel';
const head=document.createElement('div');
head.className='lidar50-top';
const title=document.createElement('strong');
title.textContent='LiDAR 50 cm · CNIG';
const id=document.createElement('span');
id.className='lidar50-sheet';
id.textContent=code?`Hoja ${code}`:sheet?'Hoja por identificar':'Fuera del ámbito';
head.append(title,id);
const button=createButton('Consultar altitud LiDAR',()=>{if(lastFile&&cachedCoversPoint()){consult(lastFile);return;}choose('consult');},'lidar50-primary');
const result=document.createElement('div');
result.className='lidar50-result';
result.setAttribute('role','status');
const search=document.createElement('div');
search.className='lidar50-search';
const copy=createButton(code?'Copiar referencia':'Copiar coordenadas',async()=>{
const value=code||`${lon.toFixed(7)}, ${lat.toFixed(7)}`;
try{await navigator.clipboard.writeText(value);copy.textContent='Copiado';}catch(error){copy.textContent=value;}
},'lidar50-copy');
const link=document.createElement('a');
link.href=sheet?.known?.url||cnigCatalog;
link.target='_blank';
link.rel='noopener noreferrer';
link.textContent=sheet?.known?'Ficha del TIFF ↗':'Buscar en CNIG ↗';
search.append(copy,link);
const options=document.createElement('details');
options.className='lidar50-options';
const optionsTitle=document.createElement('summary');
optionsTitle.textContent='Archivo y cobertura';
const optionsBody=document.createElement('div');
optionsBody.className='lidar50-options-body';
const help=document.createElement('div');
help.className='lidar50-help';
help.textContent=code?`Busca ${code} en «Contiene texto» del CNIG y comprueba el nombre exacto del archivo. Disponibilidad sin verificar.`:'Hoja MTN50 sin identificar. Busca por coordenadas en el CNIG.';
const selected=document.createElement('div');
selected.className='lidar50-file';
selected.textContent=lastFile?`TIFF: ${lastFile.name}`:'TIFF: ninguno seleccionado';
const tools=document.createElement('div');
tools.className='lidar50-toolrow';
const coverage=createButton('Dibujar cobertura',()=>{if(lastFile){draw(lastFile);return;}choose('coverage');});
const change=createButton('Elegir otro TIFF',()=>choose('consult'));
tools.append(coverage,change);
const hide=createButton('Ocultar cobertura',()=>{hideCoverage?.();coverageStatus.textContent='Cobertura oculta.';},'lidar50-change');
const coverageStatus=document.createElement('div');
coverageStatus.className='lidar50-coverage-status';
coverageStatus.setAttribute('role','status');
const coordinates=document.createElement('div');
coordinates.className='lidar50-coordinates';
coordinates.textContent=`Latitud ${lat.toFixed(7)} · Longitud ${lon.toFixed(7)}${sheet?.column!==null&&sheet?.column!==undefined?` · Cuadrícula ${sheet.column}-${sheet.row}`:''}`;
optionsBody.append(help,selected,tools,hide,coverageStatus,coordinates);
options.append(optionsTitle,optionsBody);
const input=document.createElement('input');
input.type='file';
input.accept='.tif,.tiff,image/tiff';
input.hidden=true;
let selectionMode='consult';
function cachedCoversPoint(){
if(!lastFile||!lastImage||!window.proj4)return false;
try{pixelPosition(lastImage,lon,lat);return true;}catch(error){return false;}
}
function updateSelectionAction(){
button.textContent=lastFile&&!cachedCoversPoint()?'Seleccionar TIFF de esta hoja':'Consultar altitud LiDAR';
}
function choose(mode){selectionMode=mode;input.click();}
input.addEventListener('change',()=>{
const file=input.files?.[0];
input.value='';
if(file){if(selectionMode==='coverage')draw(file);else consult(file);}
});
function showFootprint(file,image,forceZoom=false){
if(!showCoverage)return;
showCoverage(footprint(image),forceZoom||lastCoverageFile!==file);
lastCoverageFile=file;
coverageStatus.textContent='Cobertura dibujada sobre el mapa (puede incluir zonas sin datos).';
}
async function draw(file){
coverage.disabled=true;
coverageStatus.textContent='Leyendo la cobertura…';
try{
const image=await openLidar(file,ensureGeoTiff);
selected.textContent=`TIFF: ${file.name}`;
showFootprint(file,image,true);
}catch(error){coverageStatus.textContent=`No se pudo dibujar: ${error.message}`;}
finally{coverage.disabled=false;updateSelectionAction();}
}
async function consult(file){
button.disabled=true;
result.textContent='Leyendo el TIFF…';
try{
const image=await openLidar(file,ensureGeoTiff);
selected.textContent=`TIFF: ${file.name}`;
const sample=await readLidar(image,lon,lat);
showFootprint(file,image);
const fileCode=readName(file);
const warning=code&&fileCode&&fileCode!==code?` · Aviso: TIFF ${fileCode}, hoja calculada ${code}.`:'';
if(sample.value===null){result.textContent=`Sin datos de elevación en este píxel.${warning}`;return;}
const altitude=sample.value.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
const diff=Number.isFinite(osmEle)?` · Diferencia con OSM: ${(osmEle-sample.value).toLocaleString('es-ES',{maximumFractionDigits:2})} m`:'';
result.textContent=`Altitud LiDAR: ${altitude} m${diff}${warning}`;
}catch(error){
const outside=error.message==='El GeoTIFF seleccionado no cubre estas coordenadas.';
result.textContent=outside?`El TIFF seleccionado no cubre este elemento. Selecciona el archivo de la hoja ${code||'correspondiente'}.`:`No se pudo consultar: ${error.message}`;
}finally{button.disabled=false;updateSelectionAction();}
}
section.append(head,button,result,search,options,input);
updateSelectionAction();
return section;
}
