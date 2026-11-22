import { api, createGeocoder, links, reason, verify } from './client';
import { defaultLocale, isLocale, type Locale } from '../../i18n/config';
import { editorCopy, formatMapMessage } from '../../i18n/map-editor';
import { setupImport } from './import-dialog';
import { COLORS, configSchema, coordinate, DEFAULT_MARKER_LIMIT, mapSchema, markerColor, markerSchema, recoverySchema, settingsSchema, type GeocodeResult, type MapConfig, type Marker, type PublicConfig } from './schema';

export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(`mm-${id}`) as T;
export const dataText = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

const examples = [
  { title: 'Central Park', address: 'Manhattan, New York', lat: 40.7736, lng: -73.9708, color: 'green' },
  { title: 'New York Public Library', address: '476 Fifth Avenue, New York', lat: 40.7532, lng: -73.9822, color: 'blue' },
  { title: 'Brooklyn Bridge', address: 'New York, New York', lat: 40.7061, lng: -73.9969, color: 'purple' },
].map((entry) => markerSchema.parse(entry));

function makeButton(text: string, label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-ghost-sm';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', action);
  return button;
}

export async function startEditor() {
  const root = document.querySelector<HTMLElement>('#location-editor')!;
  const htmlLanguage = document.documentElement.lang;
  const lang = isLocale(htmlLanguage) ? htmlLanguage : defaultLocale;
  const copy = editorCopy[lang];
  let config: PublicConfig = configSchema.parse({ markerLimit: DEFAULT_MARKER_LIMIT, turnstileSiteKey: '', geocoding: false });
  try { config = configSchema.parse(await api('/api/map-tool/config', 'GET', undefined, undefined, AbortSignal.timeout(4000))); }
  catch { /* The local coordinate editor is available without hosted services. */ }
  const geocoder = createGeocoder(config.turnstileSiteKey, lang);
  const editorStatus = byId('edit-status');
  const markerDialog = byId<HTMLDialogElement>('marker-dialog');
  const markerForm = byId<HTMLFormElement>('marker-form');
  const colorSelect = markerForm.elements.namedItem('color') as HTMLSelectElement;
  const customColor = markerForm.elements.namedItem('customColor') as HTMLInputElement;
  const locations = byId<HTMLOListElement>('locations');
  const settingsForm = byId<HTMLFormElement>('settings');
  const publishForm = byId<HTMLFormElement>('publish');
  const publishStatus = byId('publish-status');
  const mapButton = byId<HTMLButtonElement>('map-pick');
  const fitButton = byId<HTMLButtonElement>('fit');
  const exampleButton = byId<HTMLButtonElement>('example');
  const preview = byId('live-preview');
  const saveButton = byId<HTMLButtonElement>('save');
  const camera = byId('canvas');
  let markers: Marker[] = [];
  let settings = settingsSchema.parse({});
  let liveMap: ReturnType<typeof import('./maplibre').mountMap> | undefined;
  let editingIndex: number | undefined;
  let picking = false;
  let ownership: { id: string; token: string } | undefined;
  let busy = false;

  function setPicking(value: boolean) {
    picking = value;
    mapButton.setAttribute('aria-pressed', String(value));
    camera.classList.toggle('mm-picking', value);
    if (value) editorStatus.textContent = copy.pick;
    else if (editorStatus.textContent === copy.pick) editorStatus.textContent = '';
  }

  function render(reframe = false, focus?: { index: number; label: string }) {
    byId('count').textContent = `${markers.length} / ${config.markerLimit}`;
    byId('empty').hidden = markers.length > 0;
    exampleButton.hidden = markers.length > 0;
    fitButton.disabled = !liveMap || markers.length === 0;
    locations.replaceChildren();
    markers.forEach((marker, index) => {
      const li = document.createElement('li');
      const heading = document.createElement('div');
      heading.className = 'mm-row-title';
      const count = document.createElement('span');
      count.className = 'mm-row-number';
      count.style.backgroundColor = markerColor(marker.color);
      count.textContent = String(index + 1);
      count.setAttribute('aria-label', formatMapMessage(copy.numberLabel, { color: copy[marker.color as keyof typeof COLORS] ?? marker.color, position: index + 1 }));
      const title = document.createElement('strong');
      title.textContent = marker.title;
      heading.append(count, title);
      const address = document.createElement('p');
      address.textContent = marker.address || `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;
      const actions = document.createElement('div');
      actions.className = 'mm-actions';
      const view = makeButton(copy.show, formatMapMessage(copy.showLocation, { title: marker.title }), () => liveMap?.show(index));
      const edit = makeButton(copy.edit, formatMapMessage(copy.editLocation, { title: marker.title }), () => openMarker(marker, index));
      const remove = makeButton(copy.delete, formatMapMessage(copy.deleteLocation, { title: marker.title }), () => {
        markers = markers.filter((_, row) => row !== index);
        const nextIndex = Math.min(index, markers.length - 1);
        render(true, { index: nextIndex, label: copy.delete });
        if (nextIndex < 0) exampleButton.focus();
        editorStatus.textContent = formatMapMessage(copy.deleted, { title: marker.title });
      });
      const earlier = makeButton(copy.up, formatMapMessage(copy.moveUp, { title: marker.title }), () => reorder(index, -1));
      const later = makeButton(copy.down, formatMapMessage(copy.moveDown, { title: marker.title }), () => reorder(index, 1));
      earlier.disabled = index === 0;
      later.disabled = index === markers.length - 1;
      const buttons = [view, edit, remove, earlier, later];
      actions.append(...buttons);
      li.append(heading, address, actions);
      locations.append(li);
      if (focus?.index === index) (buttons.find((button) => button.textContent === focus.label && !button.disabled) ?? edit).focus();
    });
    liveMap?.draw(markers, settings, reframe);
  }

  function reorder(index: number, delta: number) {
    const next = index + delta;
    const ordered = [...markers];
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    markers = ordered;
    render(false, { index: next, label: delta < 0 ? copy.up : copy.down });
    editorStatus.textContent = formatMapMessage(copy.reordered, { title: markers[next].title, position: next + 1 });
  }

  function add(items: Marker[]): boolean {
    if (markers.length + items.length > config.markerLimit) {
      editorStatus.textContent = formatMapMessage(copy.limit, { count: config.markerLimit });
      return false;
    }
    markers = [...markers, ...items];
    render(true);
    editorStatus.textContent = items.length === 1 ? formatMapMessage(copy.addedOne, { title: items[0].title }) : formatMapMessage(copy.addedMany, { count: items.length });
    return true;
  }

  function loadExample() {
    settings = { ...settings, fit: true, cluster: false };
    writeSettings();
    const descriptions = [copy.centralPark, copy.library, copy.bridge];
    add(examples.slice(0, config.markerLimit).map((marker, index) => ({ ...marker, description: descriptions[index] })));
  }

  function openMarker(marker?: Partial<Marker>, index?: number) {
    if (index === undefined && markers.length >= config.markerLimit) {
      editorStatus.textContent = formatMapMessage(copy.limit, { count: config.markerLimit });
      return;
    }
    editingIndex = index;
    markerForm.reset();
    byId('marker-heading').textContent = index === undefined ? copy.newMarker : copy.editMarker;
    byId('marker-error').textContent = '';
    for (const [key, value] of Object.entries(marker ?? {})) {
      const field = markerForm.elements.namedItem(key) as HTMLInputElement | null;
      if (field) field.value = String(value);
    }
    if (marker?.color?.startsWith('#')) {
      colorSelect.value = 'custom';
      customColor.value = marker.color;
    }
    byId('custom-color').hidden = colorSelect.value !== 'custom';
    markerDialog.showModal();
    (markerForm.elements.namedItem('title') as HTMLInputElement).focus();
  }

  colorSelect.addEventListener('change', () => { byId('custom-color').hidden = colorSelect.value !== 'custom'; });
  markerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = new FormData(markerForm);
    const result = markerSchema.safeParse({
      ...Object.fromEntries(fields),
      color: colorSelect.value === 'custom' ? customColor.value : colorSelect.value,
      lat: coordinate(dataText(fields, 'lat')),
      lng: coordinate(dataText(fields, 'lng')),
      website: editingIndex === undefined ? undefined : markers[editingIndex].website,
    });
    if (!result.success) {
      byId('marker-error').textContent = copy.invalidMarker;
      return;
    }
    markerDialog.close();
    if (editingIndex === undefined) add([result.data]);
    else {
      const pointMoved = markers[editingIndex].lat !== result.data.lat || markers[editingIndex].lng !== result.data.lng;
      markers = markers.map((marker, index) => index === editingIndex ? result.data : marker);
      render(pointMoved, { index: editingIndex, label: copy.edit });
      editorStatus.textContent = formatMapMessage(copy.updated, { title: result.data.title });
    }
  });

  root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  byId('coordinates').addEventListener('click', () => openMarker());
  exampleButton.addEventListener('click', loadExample);
  byId<HTMLAnchorElement>('guide-example').addEventListener('click', (event) => {
    if (markers.length || ownership || busy || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    loadExample();
    preview.scrollIntoView();
    preview.focus({ preventScroll: true });
  });
  mapButton.disabled = true;
  mapButton.addEventListener('click', () => setPicking(!picking));
  fitButton.addEventListener('click', () => liveMap?.fit());

  function writeSettings() {
    for (const [key, value] of Object.entries(settings)) {
      const field = settingsForm.elements.namedItem(key) as HTMLInputElement;
      if (typeof value === 'boolean') field.checked = value;
      else field.value = String(value);
    }
    (settingsForm.elements.namedItem('width') as HTMLInputElement).disabled = settings.responsive;
  }

  settingsForm.addEventListener('submit', (event) => event.preventDefault());
  settingsForm.addEventListener('change', () => {
    const data = new FormData(settingsForm);
    const values = { ...Object.fromEntries(data), width: data.has('width') ? Number(data.get('width')) : settings.width, height: Number(data.get('height')), zoom: Number(data.get('zoom')) };
    const switches = Object.fromEntries(['responsive', 'fit', 'zoomControls', 'scrollWheel', 'cluster', 'labels'].map((key) => [key, data.has(key)]));
    const parsed = settingsSchema.safeParse({ ...values, ...switches });
    if (!parsed.success) return;
    const reframe = parsed.data.fit !== settings.fit || parsed.data.zoom !== settings.zoom;
    settings = parsed.data;
    writeSettings();
    liveMap?.draw(markers, settings, reframe);
  });

  initSearch(geocoder, config, lang, (result) => add([markerSchema.parse({ ...result, title: result.title || result.address })]));
  setupImport(geocoder, config, () => Math.max(0, config.markerLimit - markers.length), add, lang);

  function showLinks(id: string, saved: MapConfig) {
    const { code, share } = links(id, saved);
    byId<HTMLTextAreaElement>('embed-code').value = code;
    byId<HTMLInputElement>('share-url').value = share;
    byId<HTMLAnchorElement>('preview').href = share;
    byId('result').hidden = false;
    saveButton.textContent = copy.saveChanges;
  }

  function reset() {
    ownership = undefined;
    markers = [];
    settings = settingsSchema.parse({});
    writeSettings();
    publishForm.reset();
    byId('result').hidden = true;
    byId('copy-status').textContent = '';
    publishStatus.textContent = '';
    editorStatus.textContent = '';
    saveButton.textContent = copy.generate;
    render();
  }

  function setBusy(value: boolean) {
    busy = value;
    for (const id of ['save', 'another', 'recover', 'delete-map']) byId<HTMLButtonElement>(id).disabled = value;
  }

  publishForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!settingsForm.reportValidity()) {
      byId<HTMLDetailsElement>('settings-panel').open = true;
      settingsForm.reportValidity();
      return;
    }
    const form = new FormData(publishForm);
    const parsed = mapSchema.safeParse({ title: dataText(form, 'title'), description: dataText(form, 'description'), markers, settings });
    if (!parsed.success || markers.length > config.markerLimit) {
      publishStatus.textContent = formatMapMessage(copy.invalidMap, { count: config.markerLimit });
      return;
    }
    const saved = parsed.data;
    setBusy(true);
    try {
      if (ownership) await api(`/api/maps/${ownership.id}`, 'PATCH', saved, { Authorization: `Bearer ${ownership.token}` });
      else ownership = recoverySchema.parse(await api('/api/maps', 'POST', { configuration: saved, verification: await verify(config.turnstileSiteKey, 'publish-map', lang) }));
      showLinks(ownership.id, saved);
      publishStatus.textContent = copy.mapSaved;
    } catch (error) { publishStatus.textContent = reason(error, copy.saveFailed, lang); }
    finally { setBusy(false); }
  });

  const recoveryFile = byId<HTMLInputElement>('recovery-file');
  byId('recover').addEventListener('click', () => recoveryFile.click());
  recoveryFile.addEventListener('change', async () => {
    const file = recoveryFile.files?.[0];
    recoveryFile.value = '';
    if (!file || busy) return;
    if (file.size > 4096) { publishStatus.textContent = copy.badRecovery; return; }
    if (markers.length && !window.confirm(copy.replaceLocations)) return;
    setBusy(true);
    try {
      const credentials = recoverySchema.parse(JSON.parse(await file.text()));
      const result = await api('/api/map-tool/recover', 'POST', { id: credentials.id }, { Authorization: `Bearer ${credentials.token}` }) as { configuration: unknown };
      const saved = mapSchema.parse(result.configuration);
      ownership = credentials;
      markers = saved.markers;
      settings = saved.settings;
      writeSettings();
      (publishForm.elements.namedItem('title') as HTMLInputElement).value = saved.title;
      (publishForm.elements.namedItem('description') as HTMLTextAreaElement).value = saved.description;
      render(true);
      showLinks(credentials.id, saved);
      publishStatus.textContent = copy.mapOpened;
    } catch (error) { publishStatus.textContent = reason(error, copy.badRecovery, lang); }
    finally { setBusy(false); }
  });

  byId('download').addEventListener('click', () => {
    if (!ownership) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(ownership, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `map-${ownership.id}-recovery.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  byId('another').addEventListener('click', () => {
    if (window.confirm(copy.confirmNew)) reset();
  });
  byId('delete-map').addEventListener('click', async () => {
    if (!ownership || busy || !window.confirm(copy.confirmDelete)) return;
    setBusy(true);
    try {
      await api(`/api/maps/${ownership.id}`, 'DELETE', undefined, { Authorization: `Bearer ${ownership.token}` });
      reset();
      publishStatus.textContent = copy.mapDeleted;
    } catch (error) { publishStatus.textContent = reason(error, copy.deleteFailed, lang); }
    finally { setBusy(false); }
  });

  for (const [button, field] of [['copy-code', 'embed-code'], ['copy-url', 'share-url']]) {
    byId(button).addEventListener('click', async () => {
      const input = byId<HTMLInputElement | HTMLTextAreaElement>(field);
      try {
        await navigator.clipboard.writeText(input.value);
        byId('copy-status').textContent = field === 'embed-code' ? copy.copiedCode : copy.copiedUrl;
      } catch {
        input.focus();
        input.select();
        byId('copy-status').textContent = copy.copyFallback;
      }
    });
  }

  root.inert = false;
  byId('initial-status').hidden = true;
  if (new URLSearchParams(location.search).get('example') === 'nyc') {
    loadExample();
    if (location.hash === '#mm-live-preview') preview.scrollIntoView();
    else if (location.hash === '#location-editor') root.scrollIntoView();
  } else {
    writeSettings();
    render();
  }
  try {
    const { mountMap } = await import('./maplibre');
    const mapNote = byId('map-note');
    const instructions = copy.mapInstructions;
    const unavailable = copy.basemapUnavailable;
    liveMap = mountMap(camera, markers, settings, {
      copy,
      add(lat, lng) {
        if (!picking) return;
        setPicking(false);
        openMarker({ lat, lng });
      },
      move(index, lat, lng) {
        markers = markers.map((marker, row) => row === index ? { ...marker, lat, lng, address: '' } : marker);
        render();
        editorStatus.textContent = formatMapMessage(copy.moved, { title: markers[index].title });
      },
      tileStatus(available) {
        const text = available ? instructions : unavailable;
        if (mapNote.textContent !== text) mapNote.textContent = text;
      },
    });
    mapButton.disabled = false;
    mapNote.textContent = instructions;
    render();
  } catch { byId('map-note').textContent = copy.previewFailed; }
}

function initSearch(geocoder: ReturnType<typeof createGeocoder>, config: PublicConfig, lang: Locale, add: (marker: GeocodeResult) => boolean) {
  const copy = editorCopy[lang];
  const form = byId<HTMLFormElement>('search');
  const query = byId<HTMLInputElement>('query');
  const list = byId('suggestions');
  const status = byId('search-note');
  let timer = 0;
  let request: AbortController | undefined;
  let generation = 0;
  let unlocking = false;
  let lastInput = '';

  function resetResults() {
    ++generation;
    clearTimeout(timer);
    request?.abort();
    list.replaceChildren();
    list.hidden = true;
  }

  async function search(mode: 'autocomplete' | 'search', value: string, version: number) {
    const controller = new AbortController();
    request = controller;
    try {
      const results = await geocoder.search(value, mode, controller.signal);
      if (version !== generation) return;
      for (const result of results) {
        const row = document.createElement('li');
        row.append(makeButton(result.address, formatMapMessage(copy.addResult, { address: result.address }), () => {
          if (!add(result)) { status.textContent = copy.limitReached; return; }
          query.value = '';
          lastInput = '';
          status.textContent = '';
          resetResults();
          query.focus();
        }));
        list.append(row);
      }
      list.hidden = results.length === 0;
      status.textContent = results.length ? copy.pickResult : mode === 'search' ? copy.noResults : '';
    } catch (error) {
      if (version === generation && !controller.signal.aborted) status.textContent = reason(error, copy.searchFailed, lang);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!config.geocoding || unlocking) return;
    const value = query.value.trim();
    if (value.length < 3) return;
    resetResults();
    const version = generation;
    unlocking = true;
    status.textContent = copy.searching;
    try {
      await geocoder.unlock();
      if (version === generation) await search('search', value, version);
    } catch (error) { if (version === generation) status.textContent = reason(error, copy.searchStartFailed, lang); }
    finally { unlocking = false; }
  });
  query.addEventListener('input', () => {
    const value = query.value.trim();
    const normalized = value.normalize('NFC').replace(/\s+/g, ' ').toLowerCase();
    if (normalized === lastInput) return;
    lastInput = normalized;
    resetResults();
    status.textContent = '';
    if (!config.geocodeAutocomplete || value.length < 3 || !geocoder.unlocked()) return;
    const version = generation;
    timer = window.setTimeout(() => void search('autocomplete', value, version), 600);
  });
  query.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') resetResults();
    if (event.key === 'ArrowDown' && !list.hidden) {
      event.preventDefault();
      list.querySelector('button')?.focus();
    }
  });
  if (!config.geocoding) {
    query.disabled = true;
    form.querySelector('button')!.disabled = true;
    status.textContent = copy.searchUnavailable;
  }
}
