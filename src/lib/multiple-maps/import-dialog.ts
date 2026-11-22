import type { Locale } from '../../i18n/config';
import { editorCopy, formatMapMessage } from '../../i18n/map-editor';
import { ApiError, createGeocoder, reason } from './client';
import { csvRows, pasteRows, validateRow, type ImportRow } from './imports';
import { markerSchema, MAX_CSV_BYTES, type GeocodeResult, type Marker, type PublicConfig } from './schema';

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`mm-${id}`) as T;
const fields = ['title', 'address', 'description', 'latitude', 'longitude', 'color'] as const satisfies readonly (keyof ImportRow)[];

interface PendingRow {
  input: ImportRow;
  number: number;
  issue?: string;
  results?: GeocodeResult[];
  selection?: GeocodeResult;
  done?: boolean;
}

export function setupImport(geocoder: ReturnType<typeof createGeocoder>, config: PublicConfig, capacity: () => number, add: (markers: Marker[]) => boolean, lang: Locale) {
  const copy = editorCopy[lang];
  const dialog = get<HTMLDialogElement>('import-dialog');
  const form = get<HTMLFormElement>('import-form');
  const list = get('import-rows');
  const status = get('import-status');
  const preview = get<HTMLButtonElement>('preview-import');
  const run = get<HTMLButtonElement>('run-import');
  const close = get<HTMLButtonElement>('close-import');
  const file = get<HTMLInputElement>('csv-file');
  const lines = get<HTMLTextAreaElement>('lines');
  let mode: 'paste' | 'csv';
  let rows: PendingRow[] = [];
  let busy = false;

  function open(kind: typeof mode) {
    mode = kind;
    rows = [];
    form.reset();
    status.textContent = [formatMapMessage(copy.capacity, { count: capacity() }), config.geocodeBulk ? '' : copy.bulkUnavailable].filter(Boolean).join(' ');
    get('import-heading').textContent = kind === 'csv' ? copy.csvHeading : copy.bulk;
    get('csv-fields').hidden = kind !== 'csv';
    get('paste-fields').hidden = kind !== 'paste';
    render();
    dialog.showModal();
  }

  function render() {
    list.replaceChildren();
    for (const row of rows) {
      if (row.done) continue;
      const item = document.createElement('li');
      const summary = document.createElement('strong');
      summary.textContent = `${row.number}. ${row.input.title || row.input.address || copy.location}`;
      const details = document.createElement('p');
      details.textContent = row.issue || (row.input.latitude && row.input.longitude
        ? formatMapMessage(copy.rowCoordinates, { lat: row.input.latitude, lon: row.input.longitude }) : copy.lookup);
      item.append(summary, details);
      if (row.results?.length) {
        const label = document.createElement('label');
        label.textContent = copy.chooseResult;
        const select = document.createElement('select');
        select.className = 'input';
        select.add(new Option(copy.selectLocation, ''));
        row.results.forEach((result, index) => select.add(new Option(result.address, String(index))));
        select.value = row.selection ? String(row.results.indexOf(row.selection)) : '';
        select.disabled = busy;
        select.addEventListener('change', () => { row.selection = select.value === '' ? undefined : row.results?.[Number(select.value)]; });
        label.append(select);
        item.append(label);
      }
      const editor = document.createElement('details');
      const toggle = document.createElement('summary');
      toggle.textContent = copy.editRow;
      editor.append(toggle);
      const inputs = document.createElement('div');
      inputs.className = 'mm-fields';
      for (const key of fields) {
        const label = document.createElement('label');
        label.textContent = copy[key];
        const input = document.createElement('input');
        input.className = 'input';
        input.maxLength = key === 'description' ? 1000 : key === 'address' ? 300 : 120;
        if (key === 'color') input.placeholder = copy.colorHint;
        input.value = row.input[key];
        input.disabled = busy;
        input.addEventListener('input', () => {
          row.input[key] = input.value.trim();
          if (key === 'address') {
            row.results = undefined;
            row.selection = undefined;
            item.querySelector('select:not(details select)')?.closest('label')?.remove();
          }
        });
        label.append(input);
        inputs.append(label);
      }
      editor.append(inputs);
      item.append(editor);
      list.append(item);
    }
    run.hidden = !rows.some((row) => !row.done);
    run.textContent = rows.some((row) => row.done || row.issue) ? copy.retryRows : copy.addLocations;
  }

  get('bulk').addEventListener('click', () => open('paste'));
  get('csv').addEventListener('click', () => open('csv'));
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });

  function setBusy(value: boolean) {
    busy = value;
    for (const element of [preview, run, close, file, lines]) element.disabled = value;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      let values: ImportRow[];
      if (mode === 'csv') {
        const input = file.files?.[0];
        if (!input || input.size > MAX_CSV_BYTES) throw new Error(copy.chooseFile);
        values = await csvRows(await input.text(), copy);
      } else values = pasteRows(lines.value);
      const remaining = capacity();
      if (!values.length) throw new Error(copy.needLocation);
      if (values.length > remaining) throw new Error(formatMapMessage(copy.tooManyRows, { count: remaining }));
      rows = values.map((input, index) => ({ input, number: index + 1, issue: validateRow(input, copy).issue }));
      status.textContent = values.length === 1 ? copy.previewOne : formatMapMessage(copy.previewMany, { count: values.length });
    } catch (error) {
      rows = [];
      status.textContent = error instanceof Error ? error.message : copy.readFailed;
    } finally { setBusy(false); render(); }
  });

  run.addEventListener('click', async () => {
    if (busy) return;
    const remaining = rows.filter((row) => !row.done);
    if (remaining.length > capacity()) {
      status.textContent = formatMapMessage(copy.capacityChanged, { count: capacity() });
      return;
    }
    setBusy(true);
    render();
    let processed = 0;
    let nextAddressAt = 0;
    let lookupIssue = config.geocodeBulk ? '' : copy.rowNoLookup;
    const resolved: Array<{ row: PendingRow; marker: Marker }> = [];
    const needsLookup = remaining.some((row) => {
      const validation = validateRow(row.input, copy);
      return !row.results && !validation.marker && !validation.issue;
    });
    try {
      if (needsLookup && !lookupIssue) {
        try { await geocoder.unlock(); }
        catch (error) { lookupIssue = reason(error, copy.lookupVerifyFailed, lang); }
      }
      for (const row of remaining) {
        status.textContent = formatMapMessage(copy.checking, { current: ++processed, total: remaining.length });
        const validation = validateRow(row.input, copy);
        row.issue = validation.issue;
        if (validation.issue) continue;
        if (validation.marker) { resolved.push({ row, marker: validation.marker }); continue; }
        let picked = row.selection;
        if (!picked && row.results) { row.issue = copy.chooseOrEdit; continue; }
        if (!picked && lookupIssue) { row.issue = lookupIssue; continue; }
        if (!picked) {
          try {
            const wait = nextAddressAt - Date.now();
            if (wait > 0) await new Promise<void>((done) => window.setTimeout(done, wait));
            nextAddressAt = Date.now() + 1100;
            const results = await geocoder.search(row.input.address, 'bulk');
            if (!results.length) { row.issue = copy.noMatch; continue; }
            if (results.length > 1) { row.results = results; row.issue = copy.chooseOrEdit; continue; }
            picked = results[0];
          } catch (error) {
            row.issue = reason(error, copy.lookupFailed, lang);
            if (error instanceof ApiError && [403, 429, 503].includes(error.status)) lookupIssue = row.issue;
            continue;
          }
        }
        const result = markerSchema.safeParse({ ...row.input, ...picked, title: row.input.title || picked.title });
        if (result.success) resolved.push({ row, marker: result.data });
        else row.issue = copy.checkRow;
      }
      if (resolved.length && add(resolved.map(({ marker }) => marker))) {
        for (const { row } of resolved) row.done = true;
      }
      const pending = rows.filter((row) => !row.done).length;
      const added = remaining.length - pending;
      const completed = formatMapMessage(copy.importAdded, { count: added });
      status.textContent = completed + ' ' + (pending ? formatMapMessage(copy.importPending, { count: pending }) : copy.importDone);
    } finally { setBusy(false); render(); }
  });
}
