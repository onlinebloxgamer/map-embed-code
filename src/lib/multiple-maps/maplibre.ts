import { LngLatBounds, Map as MapLibre, Marker as MapPin, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapGeoJSONFeature, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../../styles/multiple-map-canvas.css';
import { markerColor, STYLES, type MapSettings, type Marker } from './schema';

setWorkerUrl(workerUrl);

const source = 'location-markers';
const clusters = 'location-clusters';
const singles = 'location-singles';
const styleUrl = (style: MapSettings['style']) => `https://tiles.openfreemap.org/styles/${STYLES[style]}`;
const attribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';
const emptyStyle: StyleSpecification = { version: 8, sources: {}, layers: [] };

interface MapActions {
  add?: (lat: number, lng: number) => void;
  move?: (index: number, lat: number, lng: number) => void;
  tileStatus?: (available: boolean) => void;
  savedView?: boolean;
}

function popupContent(marker: Marker): HTMLElement {
  const wrapper = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = marker.title;
  wrapper.append(title);
  for (const value of [marker.address, marker.description]) {
    if (!value) continue;
    const paragraph = document.createElement('p');
    paragraph.textContent = value;
    wrapper.append(paragraph);
  }
  if (marker.website) {
    const link = document.createElement('a');
    link.href = marker.website;
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow ugc';
    link.textContent = 'Visit website';
    wrapper.append(link);
  }
  return wrapper;
}

function point(marker: Marker): [number, number] {
  return [marker.lng, Math.max(-85.051129, Math.min(85.051129, marker.lat))];
}

// Choose the shortest longitude span for maps crossing the antimeridian.
function bounds(markers: Marker[]): LngLatBounds {
  const longitudes = markers.map(({ lng }) => lng).sort((a, b) => a - b);
  let west = longitudes[0];
  let east = longitudes[longitudes.length - 1];
  let gap = west + 360 - east;
  for (let index = 1; index < longitudes.length; index++) {
    const nextGap = longitudes[index] - longitudes[index - 1];
    if (nextGap > gap) {
      gap = nextGap;
      west = longitudes[index];
      east = longitudes[index - 1] + 360;
    }
  }
  const latitudes = markers.map((marker) => point(marker)[1]);
  return new LngLatBounds([west, Math.min(...latitudes)], [east, Math.max(...latitudes)]);
}

function positions(markers: Marker[]) {
  const groups = new Map<string, number[]>();
  const offsets = markers.map((marker): [number, number] => [0, marker.icon === 'circle' ? 0 : -9]);
  markers.forEach(({ lat, lng }, index) => {
    const key = `${lat},${lng}`;
    const group = groups.get(key) ?? [];
    group.push(index);
    groups.set(key, group);
  });
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const radius = Math.max(20, 12 * group.length / Math.PI);
    group.forEach((index, position) => {
      const angle = position / group.length * 2 * Math.PI;
      offsets[index] = [Math.cos(angle) * radius, offsets[index][1] + Math.sin(angle) * radius];
    });
  }
  return offsets;
}

export function mountMap(element: HTMLElement, initialMarkers: Marker[], initialSettings: MapSettings, actions: MapActions = {}) {
  let settings = initialSettings;
  let markers = initialMarkers;
  let pins: MapPin[] = [];
  let ready = false;
  let basemap = true;
  let styleTimeout: number | undefined;
  let dragging = false;
  let initialFitPending = Boolean(actions.savedView && markers.length);
  let focusedIndex: number | undefined;
  const map = new MapLibre({
    container: element, style: styleUrl(settings.style), attributionControl: false,
    center: markers.length ? point(markers[0]) : [0, 20], zoom: markers.length ? settings.zoom : 2,
    ...(!actions.savedView && settings.fit && markers.length > 1 ? { bounds: bounds(markers), fitBoundsOptions: { padding: 40, maxZoom: 17 } } : {}),
    minZoom: actions.savedView ? -2 : 1, maxZoom: 19, maxPitch: 0, dragRotate: false, pitchWithRotate: false,
    scrollZoom: settings.scrollWheel, cooperativeGestures: false,
  });
  const navigation = new NavigationControl({ showCompass: false });
  const credits = document.createElement('div');
  credits.className = 'maplibregl-ctrl maplibregl-ctrl-attrib';
  credits.innerHTML = attribution;
  map.addControl({ onAdd: () => credits, onRemove: () => credits.remove() }, 'bottom-right');
  if (settings.zoomControls) map.addControl(navigation, 'top-left');
  map.touchZoomRotate.disableRotation();
  function resize() {
    if (!element.clientWidth || !element.clientHeight) return;
    if (initialFitPending) fit();
    else map.resize();
  }
  new ResizeObserver(resize).observe(element);

  function watchStyle() {
    window.clearTimeout(styleTimeout);
    styleTimeout = window.setTimeout(() => {
      if (ready) return;
      basemap = false;
      actions.tileStatus?.(false);
      map.setStyle(emptyStyle, { diff: false });
    }, 9000);
  }

  function setPins() {
    pins.forEach((pin) => pin.remove());
    const offsets = positions(markers);
    pins = markers.map((marker, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mm-map-marker';
      button.setAttribute('aria-label', `Open ${marker.title}`);
      const shape = document.createElement('span');
      shape.className = `mm-pin mm-pin--${marker.icon}`;
      shape.style.backgroundColor = markerColor(marker.color);
      if (marker.icon === 'number') shape.textContent = String(index + 1);
      button.append(shape);
      if (settings.labels) {
        const label = document.createElement('span');
        label.className = 'mm-marker-label';
        label.textContent = marker.title;
        button.append(label);
      }
      const pop = new Popup({ offset: Math.max(19, Math.abs(offsets[index][1]) + 12), maxWidth: '270px' }).setDOMContent(popupContent(marker));
      const pin = new MapPin({ element: button, draggable: Boolean(actions.move), offset: offsets[index], clickTolerance: 4 })
        .setLngLat(point(marker)).setPopup(pop).addTo(map);
      pop.on('close', () => {
        if (focusedIndex !== index) return;
        focusedIndex = undefined;
        button.classList.remove('mm-marker-selected');
        syncClusters();
      });
      pin.on('dragstart', () => { dragging = true; });
      pin.on('dragend', () => {
        dragging = false;
        const coords = pin.getLngLat().wrap();
        actions.move?.(index, Number(coords.lat.toFixed(6)), Number(coords.lng.toFixed(6)));
      });
      return pin;
    });
  }

  function pinData(): GeoJSON.FeatureCollection<GeoJSON.Point> {
    return { type: 'FeatureCollection', features: markers.map((marker, index) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: point(marker) }, properties: { index },
    })) };
  }

  function syncClusters() {
    if (dragging) return;
    if (!settings.cluster || !map.getLayer(singles) || !map.isSourceLoaded(source)) {
      pins.forEach((pin) => { pin.getElement().hidden = false; });
      return;
    }
    const visible = new Set(map.queryRenderedFeatures({ layers: [singles] }).map((feature) => Number(feature.properties.index)));
    pins.forEach((pin, index) => {
      const hidden = index !== focusedIndex && !visible.has(index);
      pin.getElement().hidden = hidden;
      if (hidden && pin.getPopup()?.isOpen()) pin.togglePopup();
    });
  }

  function updateClusters() {
    if (!ready) return;
    if (!settings.cluster) {
      if (map.getSource(source)) {
        for (const layer of [singles, clusters]) map.removeLayer(layer);
        map.removeSource(source);
      }
      syncClusters();
      return;
    }
    const existing = map.getSource<GeoJSONSource>(source);
    if (existing) { existing.setData(pinData()); return; }
    map.addSource(source, { type: 'geojson', data: pinData(), cluster: true, clusterRadius: 48, clusterMaxZoom: 16 });
    map.addLayer({ id: clusters, type: 'circle', source, filter: ['has', 'point_count'], paint: {
      'circle-color': '#205e38', 'circle-radius': 21, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
    } });
    // Basemap glyphs might be unavailable. DOM cluster counts are drawn independently below.
    map.addLayer({ id: singles, type: 'circle', source, filter: ['!', ['has', 'point_count']], paint: {
      'circle-radius': 12, 'circle-opacity': 0,
    } });
  }

  const clusterPins = new Map<number, MapPin>();

  function expand(feature: MapGeoJSONFeature) {
    if (feature.geometry.type !== 'Point') return;
    const center = feature.geometry.coordinates as [number, number];
    const clusterId = Number(feature.properties.cluster_id);
    void map.getSource<GeoJSONSource>(source)?.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({ center, zoom, duration: 300 });
    }).catch(() => {});
  }

  function syncClusterCounts() {
    syncClusters();
    const active = new Set<number>();
    if (settings.cluster && map.getLayer(clusters)) {
      for (const feature of map.queryRenderedFeatures({ layers: [clusters] })) {
        if (feature.geometry.type !== 'Point') continue;
        const id = Number(feature.properties.cluster_id);
        active.add(id);
        if (clusterPins.has(id)) continue;
        const count = Number(feature.properties.point_count);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mm-cluster-count';
        button.textContent = String(count);
        button.setAttribute('aria-label', `Zoom to ${count} grouped locations`);
        button.addEventListener('click', (event) => { event.stopPropagation(); expand(feature); });
        const coords = feature.geometry.coordinates as [number, number];
        clusterPins.set(id, new MapPin({ element: button }).setLngLat(coords).addTo(map));
      }
    }
    for (const [id, pin] of clusterPins) {
      if (active.has(id)) continue;
      pin.remove();
      clusterPins.delete(id);
    }
  }

  map.on('style.load', () => {
    ready = true;
    window.clearTimeout(styleTimeout);
    actions.tileStatus?.(basemap);
    updateClusters();
  });
  map.on('error', () => actions.tileStatus?.(false));
  map.on('idle', syncClusterCounts);
  map.on('moveend', syncClusterCounts);
  map.on('click', (event) => {
    if (map.getLayer(clusters) && map.queryRenderedFeatures(event.point, { layers: [clusters] }).length) return;
    if ((event.originalEvent.target as HTMLElement | null)?.closest('.maplibregl-marker, .maplibregl-popup')) return;
    const coords = event.lngLat.wrap();
    actions.add?.(Number(coords.lat.toFixed(6)), Number(coords.lng.toFixed(6)));
  });
  watchStyle();
  setPins();
  if (actions.savedView) resize();

  function fit() {
    const { clientWidth: width, clientHeight: height } = element;
    if (!markers.length || !width || !height) return;
    initialFitPending = false;
    if (actions.savedView) {
      if (focusedIndex !== undefined) pins[focusedIndex]?.getPopup()?.remove();
      map.resize();
    }
    if (markers.length === 1) {
      map.jumpTo({ center: point(markers[0]), zoom: actions.savedView ? Math.min(settings.zoom, 15) : settings.zoom });
      return;
    }
    // Keep the pins clear of the viewer controls and attribution in short embeds.
    const side = Math.min(48, Math.floor(width / 5));
    const padding = actions.savedView
      ? { top: Math.min(84, Math.floor(height * .3)), bottom: Math.min(52, Math.floor(height * .2)), left: side, right: side }
      : 40;
    map.fitBounds(bounds(markers), { padding, maxZoom: actions.savedView ? 15 : 17, duration: 0 });
  }

  function draw(next: Marker[], options: MapSettings, reframe = false) {
    const newStyle = options.style !== settings.style;
    const newPins = next !== markers || options.labels !== settings.labels;
    const newClusters = next !== markers || options.cluster !== settings.cluster;
    if (options.zoomControls !== settings.zoomControls) {
      if (options.zoomControls) map.addControl(navigation, 'top-left');
      else map.removeControl(navigation);
    }
    if (options.scrollWheel !== settings.scrollWheel) {
      if (options.scrollWheel) map.scrollZoom.enable();
      else map.scrollZoom.disable();
    }
    markers = next;
    settings = options;
    if (reframe && markers.length) {
      if (settings.fit) fit();
      else map.jumpTo({ center: point(markers[0]), zoom: settings.zoom });
    }
    if (newStyle) {
      ready = false;
      basemap = true;
      map.setStyle(styleUrl(settings.style), { diff: false });
      watchStyle();
    }
    if (newPins) setPins();
    if (newClusters) {
      for (const pin of clusterPins.values()) pin.remove();
      clusterPins.clear();
      updateClusters();
    }
  }

  function show(index: number) {
    const pin = pins[index];
    if (!pin) return;
    const marker = markers[index];
    const zoom = pin.getElement().hidden && settings.cluster ? Math.max(17, map.getZoom()) : map.getZoom();
    if (actions.savedView) {
      initialFitPending = false;
      pins.forEach((other, position) => { if (position !== index) other.getPopup()?.remove(); });
      focusedIndex = index;
      pin.getElement().hidden = false;
      pin.getElement().classList.add('mm-marker-selected');
    }
    map.jumpTo({ center: point(marker), zoom });
    if (!pin.getPopup()?.isOpen()) pin.togglePopup();
  }

  return { draw, fit, show };
}
