self.SELF_HOST_VENDOR = self.SELF_HOST_VENDOR || null; // e.g., '/vendor'
// workers/export.worker.js
// Full export worker: tries to use jsPDF, SheetJS (XLSX), and docx. Falls back to JSON if libs unavailable.
async function loadLibs() {
  const libs = {};
  try { importScripts(self.SELF_HOST_VENDOR || '/vendor/jspdf.umd.min.js'); libs.jsPDF = self.jspdf?.jsPDF; } catch(e){}
  try { importScripts(self.SELF_HOST_VENDOR || '/vendor/xlsx.full.min.js'); libs.XLSX = self.XLSX; } catch(e){}
  try { importScripts(self.SELF_HOST_VENDOR || '/vendor/docx.umd.js'); libs.docx = self.docx; } catch(e){}
// Fallback to CDN if vendor not available
try { if (!libs.jsPDF) { importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); libs.jsPDF = self.jspdf?.jsPDF; } } catch(_){}
try { if (!libs.XLSX)  { importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); libs.XLSX = self.XLSX; } } catch(_){}
try { if (!libs.docx)  { importScripts('https://cdnjs.cloudflare.com/ajax/libs/docx/8.4.0/docx.umd.js'); libs.docx = self.docx; } } catch(_){}
  return libs;
}

function makeFilename(base, ext){ 
  const ts = new Date().toISOString().replace(/[:.]/g,'-'); 
  return base + '_' + ts + '.' + ext; 
}

function flattenScripts(scripts){
  return (scripts||[]).map((s, i) => ({
    id: s.id || i+1,
    hook: (s.hook && s.hook.text) || '',
    body: (s.body && s.body.text) || '',
    cta:  (s.cta  && s.cta.text)  || '',
    visual_dna: s.visual_dna || ''
  }));
}

function buildPDF(jsPDF, scripts){
  const doc = new jsPDF({ unit: 'pt' });
  const data = flattenScripts(scripts);
  const margin = 40;
  let y = margin;
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('Aethera Studio - Generated Scripts', margin, y); y += 24;
  doc.setFont('helvetica','normal'); doc.setFontSize(11);
  data.forEach((row, idx) => {
    if (y > 760) { doc.addPage(); y = margin; }
    doc.setFont('helvetica','bold'); doc.text(`Script #${row.id}`, margin, y); y += 16;
    doc.setFont('helvetica','normal');
    const write = (label, val) => {
      const lines = doc.splitTextToSize(val || '-', 520);
      doc.text(`${label}:`, margin, y); y += 14;
      lines.forEach(line => { if (y>760){doc.addPage(); y=margin;} doc.text(line, margin+14, y); y += 14; });
      y += 6;
    };
    write('HOOK', row.hook);
    write('BODY', row.body);
    write('CTA', row.cta);
    if (row.visual_dna) write('VISUAL DNA', row.visual_dna);
    y += 8;
  });
  return doc.output('blob');
}

function buildXLSX(XLSX, scripts){
  const data = flattenScripts(scripts);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scripts');
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function buildDOCX(docx, scripts){
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx;
  const doc = new Document({ sections: [{ properties: {}, children: [] }] });
  const children = doc.Sections[0].children;
  children.push(new Paragraph({ text: 'Aethera Studio - Generated Scripts', heading: HeadingLevel.HEADING_1 }));
  const data = flattenScripts(scripts);
  data.forEach((row) => {
    children.push(new Paragraph({ text: `Script #${row.id}`, heading: HeadingLevel.HEADING_2 }));
    const add = (label, val) => {
      children.push(new Paragraph({ children: [ new TextRun({ text: label+':', bold: true }) ] }));
      (val||'-').split('\n').forEach(line => children.push(new Paragraph({ text: line })));
    };
    add('HOOK', row.hook);
    add('BODY', row.body);
    add('CTA', row.cta);
    if (row.visual_dna) add('VISUAL DNA', row.visual_dna);
  });
  const blob = await Packer.toBlob(doc);
  return blob;
}

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};
  try {
    const libs = await loadLibs();
    let blob, filename, mime;
    const fmt = (type||'json').toLowerCase();

    if (fmt === 'pdf' && libs.jsPDF) {
      blob = buildPDF(libs.jsPDF, payload);
      filename = makeFilename('aethera_export', 'pdf');
      mime = 'application/pdf';
    } else if (fmt === 'xlsx' && libs.XLSX) {
      blob = buildXLSX(libs.XLSX, payload);
      filename = makeFilename('aethera_export', 'xlsx');
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fmt === 'docx' && libs.docx) {
      blob = await buildDOCX(libs.docx, payload);
      filename = makeFilename('aethera_export', 'docx');
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      // Fallback generic JSON
      const text = JSON.stringify({ type: fmt, scripts: payload }, null, 2);
      blob = new Blob([text], { type: 'application/json' });
      filename = makeFilename('aethera_export', 'json');
      mime = 'application/json';
    }

    const url = URL.createObjectURL(blob);
    self.postMessage({ ok: true, blobUrl: url, mime, filename });
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message || String(err) });
  }
};
