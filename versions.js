window.eleSpainVersions=Object.freeze({ol:'10.11.0',geotiff:'3.0.5',proj4:'2.22.0'});
const olImportMap=document.createElement('script');
olImportMap.type='importmap';
olImportMap.textContent=JSON.stringify({imports:{'ol/':`https://esm.sh/ol@${window.eleSpainVersions.ol}/`}});
document.head.append(olImportMap);
const olCss=document.createElement('link');
olCss.rel='stylesheet';
olCss.href=`https://cdn.jsdelivr.net/npm/ol@${window.eleSpainVersions.ol}/ol.css`;
document.head.append(olCss);
