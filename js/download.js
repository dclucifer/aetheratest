async function ensureJSPDF(){ if(window.jspdf?.jsPDF) return window.jspdf.jsPDF; await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); return window.jspdf.jsPDF; }
async function ensureXLSX(){ if(window.XLSX) return window.XLSX; await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); return window.XLSX; }
// js/download.js
import { elements, showNotification, getFullScriptText, getCharacterDescriptionString, languageState} from './utils.js';
import { t } from './i18n.js';
import { getScripts } from './state.js';

let __jsPdfPromise;
async function getJsPDF(){
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    __jsPdfPromise = __jsPdfPromise || ensureJSPDF();
    return __jsPdfPromise;
}
const XLSX = window.XLSX;

export function downloadAllScripts(format) {
    // PERUBAHAN DI SINI
    const lastGeneratedScripts = getScripts(); // Menggunakan state manager
    
    if (lastGeneratedScripts.length === 0) {
        showNotification(t('notification_no_script_to_download'), 'warning');
        return;
    }
    const productName = elements.inputs.productName.value.trim() || "Aethera_Studio_Script";
    const fileName = `Aethera Studio - ${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    if (format === 'pdf') downloadAllAsPDF(lastGeneratedScripts, fileName);
    if (format === 'docx') downloadAllAsDOCX(lastGeneratedScripts, fileName);
    if (format === 'xlsx') downloadAllAsXLSX(lastGeneratedScripts, fileName);
}
async function downloadAllAsPDF(scripts, fileName) {
    const jsPDF = await getJsPDF();
    if (!jsPDF) {
        showNotification(t('export_pdf_unavailable') || 'Export PDF unavailable: jsPDF not loaded.', 'error');
        return;
    }

    const doc = new jsPDF();
    scripts.forEach((script, index) => {
        if (index > 0) doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.text(`${t('script_option')} #${index + 1}: ${script.title}`, 10, 10);
        doc.setFont('helvetica', 'normal');
        const text = getFullScriptText(script);
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 10, 20);
    });
    doc.save(`${fileName}.pdf`);
}

// Export "siap eksekusi" functions
export function gatherRows(script) {
    const rows = [];
    
    // Body Intro (jika ada)
    if (script.body_intro) {
        rows.push({
            section: 'Body',
            scene: 'intro',
            text: script.body_intro,
            t2i: '',
            i2v: ''
        });
    }
    
    // Hook
    if (script.hook) {
        rows.push({
            section: 'Hook',
            scene: 'main',
            text: script.hook.text || '',
            t2i: '',
            i2v: ''
        });
        
        if (script.hook.shots) {
            script.hook.shots.forEach((shot, i) => {
                rows.push({
                    section: 'Hook',
                    scene: `shot_${i + 1}`,
                    text: shot.visual_idea || '',
                    t2i: shot.text_to_image_prompt || '',
                    i2v: shot.image_to_video_prompt || ''
                });
            });
        }
    }
    
    // Body
    if (script.body) {
        rows.push({
            section: 'Body',
            scene: 'main',
            text: script.body.text || '',
            t2i: '',
            i2v: ''
        });
        
        if (script.body.shots) {
            script.body.shots.forEach((shot, i) => {
                rows.push({
                    section: 'Body',
                    scene: `shot_${i + 1}`,
                    text: shot.visual_idea || '',
                    t2i: shot.text_to_image_prompt || '',
                    i2v: shot.image_to_video_prompt || ''
                });
            });
        }
    }
    
    // CTA
    if (script.cta) {
        rows.push({
            section: 'CTA',
            scene: 'main',
            text: script.cta.text || '',
            t2i: '',
            i2v: ''
        });
        
        if (script.cta.shots) {
            script.cta.shots.forEach((shot, i) => {
                rows.push({
                    section: 'CTA',
                    scene: `shot_${i + 1}`,
                    text: shot.visual_idea || '',
                    t2i: shot.text_to_image_prompt || '',
                    i2v: shot.image_to_video_prompt || ''
                });
            });
        }
    }
    
    return rows;
}

export function exportPromptPackJSON(script) {
    const rows = gatherRows(script);
    const data = {
        title: script.title || 'Untitled Script',
        created_at: new Date().toISOString(),
        format: 'prompt_pack',
        rows: rows
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title || 'script'}_prompt_pack.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification(t('prompt_pack_json_downloaded_success') || 'Prompt Pack JSON berhasil diunduh!', 'success');
}

export function exportPromptPackCSV(script) {
    const rows = gatherRows(script);
    const headers = ['Section', 'Scene', 'Text', 'Text-to-Image Prompt', 'Image-to-Video Prompt'];
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        const csvRow = [
            `"${row.section}"`,
            `"${row.scene}"`,
            `"${row.text.replace(/"/g, '""')}"`,
            `"${row.t2i.replace(/"/g, '""')}"`,
            `"${row.i2v.replace(/"/g, '""')}"`
        ].join(',');
        csvContent += csvRow + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title || 'script'}_prompt_pack.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification(t('prompt_pack_csv_downloaded_success') || 'Prompt Pack CSV berhasil diunduh!', 'success');
}

// Helper function untuk format SRT time
function srtTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export function exportCapCutSRT(script) {
    const rows = gatherRows(script).filter(row => row.text.trim() !== '');
    if (rows.length === 0) {
        showNotification(t('no_text_to_export_srt') || 'Tidak ada teks untuk diekspor ke SRT', 'warning');
        return;
    }
    
    // Timing berbobot: Hook 25%, Body 60%, CTA 15%
    const totalDuration = 60; // 60 detik default
    const hookDuration = totalDuration * 0.25;
    const bodyDuration = totalDuration * 0.60;
    const ctaDuration = totalDuration * 0.15;
    
    let srtContent = '';
    let currentTime = 0;
    let subtitleIndex = 1;
    
    rows.forEach(row => {
        let segmentDuration;
        
        // Tentukan durasi berdasarkan section
        if (row.section === 'Hook') {
            segmentDuration = hookDuration / rows.filter(r => r.section === 'Hook').length;
        } else if (row.section === 'Body') {
            segmentDuration = bodyDuration / rows.filter(r => r.section === 'Body').length;
        } else if (row.section === 'CTA') {
            segmentDuration = ctaDuration / rows.filter(r => r.section === 'CTA').length;
        } else {
            segmentDuration = 2; // default 2 detik
        }
        
        const startTime = currentTime;
        const endTime = currentTime + segmentDuration;
        
        srtContent += `${subtitleIndex}\n`;
        srtContent += `${srtTime(startTime)} --> ${srtTime(endTime)}\n`;
        srtContent += `${row.text}\n\n`;
        
        currentTime = endTime;
        subtitleIndex++;
    });
    
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title || 'script'}_capcut.srt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification(t('capcut_srt_downloaded_success') || 'CapCut SRT berhasil diunduh!', 'success');
}

export function exportCapCutCSV(script) {
    const rows = gatherRows(script).filter(row => row.text.trim() !== '');
    if (rows.length === 0) {
        showNotification(t('no_text_to_export_csv') || 'Tidak ada teks untuk diekspor ke CSV', 'warning');
        return;
    }
    
    // Versi per-chunk sama rata untuk mudah di-adjust
    const segmentDuration = 3; // 3 detik per chunk
    const headers = ['Index', 'Start Time', 'End Time', 'Text', 'Section'];
    
    let csvContent = headers.join(',') + '\n';
    let currentTime = 0;
    
    rows.forEach((row, index) => {
        const startTime = currentTime;
        const endTime = currentTime + segmentDuration;
        
        const csvRow = [
            index + 1,
            srtTime(startTime),
            srtTime(endTime),
            `"${row.text.replace(/"/g, '""')}"`,
            `"${row.section}"`
        ].join(',');
        
        csvContent += csvRow + '\n';
        currentTime = endTime;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title || 'script'}_capcut.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification(t('capcut_csv_downloaded_success') || 'CapCut CSV berhasil diunduh!', 'success');
}

function downloadAllAsDOCX(scripts, fileName) {
    let combinedContent = '';
    scripts.forEach((script, index) => {
        combinedContent += `<h1>${t('script_option')} #${index + 1}: ${script.title}</h1>`;
        combinedContent += getFullScriptText(script).replace(/\n/g, '<br>');
        if (index < scripts.length - 1) combinedContent += '<br clear="all" style="page-break-before:always" />';
    });
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>${combinedContent}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function downloadAllAsXLSX(scripts, fileName) {
    const XLSXLib = await ensureXLSX();

    const wb = XLSXLib.utils.book_new();
    scripts.forEach((script, index) => {
        let data = [];
        if (script.hook) {
    data.push([
        t('part_label'), 
        t('script_text_label'), 
        t('visual_idea_label_short'), // Gunakan versi singkat
        t('t2i_prompt_label_short'),    // Gunakan versi singkat
        t('i2v_prompt_label_short')     // Gunakan versi singkat
    ]);
            data.push([t('script_title_label') || "Judul", script.title, "", "", ""]);
            if (script.character_sheet && script.character_sheet.length > 0) {
                script.character_sheet.forEach(cs => {
                    data.push([t('character_label') || "Karakter", getCharacterDescriptionString(cs)]);
                });
            }
            const addPartData = (partName, partData) => {
                partData.shots.forEach((shot, i) => {
                    data.push([
                        i === 0 ? partName : "", i === 0 ? partData.text : "",
                        shot.visual_idea, shot.text_to_image_prompt, shot.image_to_video_prompt
                    ]);
                });
            };
            addPartData(t('hook_title'), script.hook);
            addPartData(t('body_title'), script.body);
            addPartData(t('cta_title'), script.cta);
        } else if (script.slides) {
    data.push([
        t('slide_label_short'), 
        t('slide_text_label'), 
        t('t2i_prompt_label'), // Versi panjang sudah benar di sini
        t('slide_layout_suggestion'), 
        t('slide_engagement_idea')
    ]);
            script.slides.forEach((slide, i) => {
                data.push([
                    i + 1, slide.slide_text, slide.text_to_image_prompt,
                    slide.layout_suggestion || '-', slide.engagement_idea || '-'
                ]);
            });
        }
        const ws = XLSXLib.utils.aoa_to_sheet(data);
        XLSXLib.utils.book_append_sheet(wb, ws, `${t('option_label') || 'Opsi'} ${index + 1}`);
    });
    XLSXLib.writeFile(wb, `${fileName}.xlsx`);
}
