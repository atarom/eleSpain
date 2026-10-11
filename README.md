<div align="center">
<img src="assets/elespain-logo.webp" alt="eleSpain" width="540">
<h1>eleSpain</h1>
<p>Herramientas de análisis de elevaciones de OpenStreetMap frente al MDT05 para España y Andorra.</p>
</div>
---
**eleSpain** permite comprobar las etiquetas `ele=*` de nodos, vías y relaciones OSM frente a elevaciones de terreno, consultar nodos o perfiles de vías por ID o directamente desde el mapa, y dibujar perfiles personalizados con clics sobre el mapa.
El mapa utiliza **OpenLayers WebGL** y ofrece tres fuentes de elevación seleccionables: **IGN XYZ**, **COG remoto en Hugging Face** y **COG local**. El COG local puede abrir el GeoTIFF directamente desde el disco del usuario sin subirlo a ningún servidor. Se conservan los filtros adicionales de Postpass, las consultas históricas OSM, la configuración independiente por fuente y una interfaz adaptable a móvil.
### Uso
Abre la aplicación desde GitHub Pages una vez activadas las páginas del repositorio, o ejecútala localmente desde esta carpeta con `python3 -m http.server 8000` y accede a `http://localhost:8000`. No es necesario instalar dependencias ni utilizar GitHub Actions.
En **QA por zona**, establece el umbral, añade filtros de etiquetas si lo necesitas y pulsa «Analizar zona visible». En **Elemento OSM**, introduce un ID o activa «Seleccionar en mapa» y pulsa cerca de un objeto para elegirlo. En **Dibujar perfil**, activa el dibujo y pulsa sobre el mapa para incorporar vértices y consultar sus cotas. Los perfiles contienen solo los nodos o vértices escogidos, sin interpolación.
En **⚙ Ajustes** puedes seleccionar el fichero local `Spain_MDT05_INT16_WGS84.tif` para el modo COG local. Este archivo de varios GB **no forma parte del repositorio**. Se necesita conexión a Internet para OpenLayers, la cartografía de OSM y las consultas a Postpass/Overpass/API OSM; los modos remotos también requieren acceso a sus respectivos servicios.
### Fuentes y atribuciones
Datos © [OpenStreetMap](https://www.openstreetmap.org/copyright) · Terreno [IGN/CNIG (MDT05)](https://centrodedescargas.cnig.es/) · Consultas [Postpass (Geofabrik)](https://postpass.geofabrik.de/) y [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) · [IGN XYZ](https://xyz-mdt.idee.es/) · [COG de MDT05 en Hugging Face](https://huggingface.co/datasets/aTaromOCD/Spain_MDT05_INT16_WGS84) · [OpenLayers](https://openlayers.org/) · [geotiff.js](https://geotiffjs.github.io/).
Las elevaciones del terreno y las alturas de estructuras OSM pueden ser distintas: los resultados son indicios para QA, no correcciones automáticas. Los servicios públicos tienen límites de uso.
Código bajo [licencia MIT](LICENSE). El repositorio no incluye workflows, cálculos programados ni precálculos.
