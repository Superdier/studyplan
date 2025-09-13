// Tools functionality for writing practice and text-to-speech

// Writing Practice Tool
const writingText = document.getElementById('writing-text');
const generateGridBtn = document.getElementById('generate-grid');
const exportPdfBtn = document.getElementById('export-pdf');
const writingGridContainer = document.getElementById('writing-grid-container');
const writingGrid = document.getElementById('writing-grid');
const exportKanjiPdfBtn = document.getElementById('export-kanji-pdf');
const clearWritingBtn = document.getElementById('clear-writing-text');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');

// Text-to-Speech Tool
const ttsVoiceSelect = document.getElementById('tts-voice');
const ttsText = document.getElementById('tts-text');
const ttsSpeed = document.getElementById('tts-speed');
const speedValue = document.getElementById('speed-value');
const playTtsBtn = document.getElementById('play-tts');
const pauseTtsBtn = document.getElementById('pause-tts');
const stopTtsBtn = document.getElementById('stop-tts');
const clearTtsBtn = document.getElementById('clear-tts-text');
const ttsHighlightContainer = document.getElementById('tts-highlight-container');
const ttsTextDisplay = document.getElementById('tts-text-display');

// Initialize variables
let synth = window.speechSynthesis;
let utterance = null;
let currentSentenceIndex = 0;
let sentences = [];
let voices = [];
let currentFontSize = 20;

// Event Listeners for Writing Practice Tool
generateGridBtn?.addEventListener('click', generateWritingGrid);
exportPdfBtn?.addEventListener('click', exportToPDF);
exportKanjiPdfBtn?.addEventListener('click', exportKanjiPDF);
clearWritingBtn?.addEventListener('click', clearWritingText);
fontSizeSlider?.addEventListener('input', updateFontSize);

// Event Listeners for TTS Tool
ttsSpeed?.addEventListener('input', updateSpeedValue);
playTtsBtn?.addEventListener('click', playTTS);
pauseTtsBtn?.addEventListener('click', pauseTTS);
stopTtsBtn?.addEventListener('click', stopTTS);
clearTtsBtn?.addEventListener('click', clearTtsText);

// Clear writing text function
function clearWritingText() {
    if (writingText) {
        writingText.value = '';
    }
    if (writingGridContainer) {
        writingGridContainer.classList.add('hidden');
    }
    if (exportPdfBtn) {
        exportPdfBtn.disabled = true;
    }
    if (exportKanjiPdfBtn) {
        exportKanjiPdfBtn.disabled = true;
    }
}

// Clear TTS text function
function clearTtsText() {
    if (ttsText) {
        ttsText.value = '';
    }
    if (ttsHighlightContainer) {
        ttsHighlightContainer.classList.add('hidden');
    }

    // Dừng phát âm nếu đang phát
    if (synth && synth.speaking) {
        synth.cancel();

        // Reset button states
        if (playTtsBtn) playTtsBtn.disabled = false;
        if (pauseTtsBtn) pauseTtsBtn.disabled = true;
        if (stopTtsBtn) stopTtsBtn.disabled = true;
        if (pauseTtsBtn) {
            pauseTtsBtn.textContent = 'Tạm dừng';
            pauseTtsBtn.innerHTML = '<i class="fas fa-pause"></i> Tạm dừng';
        }
    }
}

// Font size control function - IMPROVED
function updateFontSize() {
    if (!fontSizeSlider || !fontSizeValue) return;

    currentFontSize = parseInt(fontSizeSlider.value);
    fontSizeValue.textContent = currentFontSize + 'px';

    // Cập nhật size cho grid hiện tại
    if (writingGrid) {
        const cells = writingGrid.querySelectorAll('.character-cell');
        const cellSize = Math.max(currentFontSize + 20, 40); // Ô luôn lớn hơn chữ ít nhất 20px
        const gap = Math.max(Math.floor(cellSize * 0.15), 5); // Gap động theo size ô (15% của cell size, tối thiểu 5px)

        cells.forEach(cell => {
            cell.style.fontSize = currentFontSize + 'px';
            cell.style.width = cellSize + 'px';
            cell.style.height = cellSize + 'px';
            cell.style.margin = Math.floor(gap / 2) + 'px'; // Chia đôi gap cho margin mỗi bên
        });

        // Cập nhật gap cho container
        writingGrid.style.gap = gap + 'px';

        // Cập nhật padding container dựa trên size
        const containerPadding = Math.max(Math.floor(cellSize * 0.3), 10);
        writingGrid.style.padding = containerPadding + 'px';
    }
}

// Speed control update
function updateSpeedValue() {
    const speed = parseFloat(ttsSpeed.value);
    speedValue.textContent = speed.toFixed(1) + 'x';
}

// Generate writing grid from Japanese text - IMPROVED
function generateWritingGrid() {
    const text = writingText.value.trim();

    if (!text) {
        showCustomAlert('Vui lòng nhập văn bản tiếng Nhật');
        return;
    }

    writingGrid.innerHTML = '';

    // Split text into characters (including punctuation and spaces)
    const characters = Array.from(text);
    const cellSize = Math.max(currentFontSize + 20, 40);
    const gap = Math.max(Math.floor(cellSize * 0.15), 5);

    characters.forEach(char => {
        const cell = document.createElement('div');
        cell.className = 'character-cell';
        cell.textContent = char;
        cell.style.fontSize = currentFontSize + 'px';
        cell.style.width = cellSize + 'px';
        cell.style.height = cellSize + 'px';
        cell.style.margin = Math.floor(gap / 2) + 'px';
        writingGrid.appendChild(cell);
    });

    // Set container properties
    writingGrid.style.gap = gap + 'px';
    const containerPadding = Math.max(Math.floor(cellSize * 0.3), 10);
    writingGrid.style.padding = containerPadding + 'px';

    writingGridContainer.classList.remove('hidden');
    exportPdfBtn.disabled = false;
    exportKanjiPdfBtn.disabled = false;
}

// Custom alert function to replace browser alert
function showCustomAlert(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '10001'; // Đảm bảo hiển thị trên cùng
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; width: auto;">
            <h3 style="margin-top: 0; color: #1a2a6c;">
                <i class="fas fa-exclamation-triangle" style="color: #fdbb2d; margin-right: 10px;"></i>
                Thông báo
            </h3>
            <p style="margin: 20px 0; color: #333;">${message}</p>
            <div style="text-align: right;">
                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-check"></i> OK
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 5000);
}

// Export writing grid to PDF (updated)
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const text = writingText.value.trim();
    if (!text) {
        showCustomAlert('Vui lòng nhập văn bản tiếng Nhật');
        return;
    }

    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    try {
        const fontUrl = '/assets/fonts/NotoSansJP-VariableFont_wght.ttf';
        console.log("Font fetch URL:", fontUrl);

        const fontResp = await fetch(fontUrl);
        if (!fontResp.ok) throw new Error('Không thể tải font từ ' + fontUrl);
        const fontBuf = await fontResp.arrayBuffer();
        const fontBase64 = arrayBufferToBase64(fontBuf);

        doc.addFileToVFS('NotoSansJP.ttf', fontBase64);
        doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal');
        doc.setFont('NotoSansJP');

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 15;
        const topTitleY = 18;

        doc.setFontSize(14);
        doc.setTextColor(20, 20, 20);
        doc.text('Luyện viết tiếng Nhật', pageW / 2, topTitleY, { align: 'center' });

        // Tính toán cell size dựa trên font size hiện tại với spacing tốt hơn
        const cellSize = Math.max((currentFontSize * 0.35), 12); // Convert px to mm approximation
        const gap = Math.max(cellSize * 0.2, 3); // 20% của cell size, tối thiểu 3mm
        const startX = margin;
        let x = startX;
        let y = topTitleY + 8;

        const mmToPt = mm => mm * 72 / 25.4;
        const fontSizePt = mmToPt(cellSize * 0.7);
        doc.setFontSize(fontSizePt);

        const chars = Array.from(text);
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];

            if (x + cellSize > pageW - margin) {
                x = startX;
                y += cellSize + gap;
            }

            if (y + cellSize > pageH - margin) {
                doc.addPage();
                x = startX;
                y = margin;
            }

            doc.setDrawColor(150);
            doc.rect(x, y, cellSize, cellSize);

            doc.setTextColor(160);
            doc.text(ch, x + cellSize / 2, y + cellSize / 2, {
                align: 'center',
                baseline: 'middle'
            });

            x += cellSize + gap;
        }

        doc.save('luyen-viet-tieng-nhat.pdf');
        return;
    } catch (err) {
        console.error('Lỗi khi tạo PDF với font nhúng:', err);
        showCustomAlert('Không thể tạo PDF bằng font nhúng. Chuyển sang phương án dự phòng (image).');
        fallbackCanvasExport(text);
    }
}

// Fallback canvas export (updated with better spacing)
function fallbackCanvasExport(text) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const cellSize = Math.max((currentFontSize * 0.35), 12);
    const gap = Math.max(cellSize * 0.2, 3);

    let x = margin;
    let y = 25;

    const chars = Array.from(text);

    chars.forEach((ch, idx) => {
        if (x + cellSize > pageW - margin) {
            x = margin;
            y += cellSize + gap;
        }
        if (y + cellSize > pageH - margin) {
            doc.addPage();
            x = margin;
            y = margin;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(cellSize * 3);
        canvas.height = Math.round(cellSize * 3);
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

        ctx.fillStyle = '#C8C8C8';
        ctx.font = `${Math.round(canvas.height * 0.6)}px "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, canvas.width / 2, canvas.height / 2);

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', x, y, cellSize, cellSize);
        x += cellSize + gap;
    });

    doc.save('luyen-viet-tieng-nhat-fallback.pdf');
}

// Kiểm tra xem ký tự có phải là Kanji không
function isKanji(char) {
    const code = char.charCodeAt(0);
    return code >= 0x4E00 && code <= 0x9FAF;
}

// Export Kanji PDF (similar updates with better spacing)
async function exportKanjiPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const text = writingText.value.trim();
    if (!text) {
        showCustomAlert('Vui lòng nhập văn bản tiếng Nhật');
        return;
    }

    function isKanji(char) {
        return /[\u4e00-\u9faf]/.test(char);
    }
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    const uniqueKanjiChars = [...new Set(Array.from(text).filter(isKanji))];
    const kanjiWords = [...new Set(text.match(/[\u4e00-\u9faf]{2,}/g) || [])];

    if (uniqueKanjiChars.length === 0 && kanjiWords.length === 0) {
        showCustomAlert('Không tìm thấy chữ hoặc từ Kanji trong văn bản.');
        return;
    }

    try {
        const fontUrl = '/assets/fonts/NotoSansJP-VariableFont_wght.ttf';
        console.log("Font fetch URL:", fontUrl);
        const fontResp = await fetch(fontUrl);
        if (!fontResp.ok) throw new Error('Không thể tải font từ ' + fontUrl);
        const fontBuf = await fontResp.arrayBuffer();
        const fontBase64 = arrayBufferToBase64(fontBuf);
        doc.addFileToVFS('NotoSansJP.ttf', fontBase64);
        doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal');
        doc.setFont('NotoSansJP');

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 15;
        const cellSize = Math.max((currentFontSize * 0.35), 12);
        const gap = Math.max(cellSize * 0.2, 3);
        const titleYOffset = 10;

        let x = margin;
        let y = margin;

        doc.setFontSize(14);
        doc.setTextColor(20, 20, 20);
        y += 8;

        const textLines = doc.splitTextToSize(text, pageW - 2 * margin);
        doc.setFontSize(10);
        doc.text(textLines, margin, y);
        y += (textLines.length * 5) + 10;
        if (y > pageH - margin) {
            doc.addPage();
            y = margin;
        }

        const mmToPt = mm => mm * 72 / 25.4;

        for (const char of uniqueKanjiChars) {
            doc.setFontSize(14);
            doc.setTextColor(20, 20, 20);
            doc.text(`Luyện viết chữ: ${char}`, pageW / 2, y, { align: 'center' });
            y += titleYOffset;

            doc.setFontSize(mmToPt(cellSize * 0.7));

            for (let i = 0; i < 10; i++) {
                if (x + cellSize > pageW - margin) {
                    x = margin;
                    y += cellSize + gap;
                }
                if (y + cellSize > pageH - margin) {
                    doc.addPage();
                    x = margin;
                    y = margin;
                    doc.setFontSize(14);
                    doc.setTextColor(20, 20, 20);
                    doc.text(`Luyện viết chữ: ${char}`, pageW / 2, y, { align: 'center' });
                    y += titleYOffset;
                    doc.setFontSize(mmToPt(cellSize * 0.7));
                }

                doc.setDrawColor(150);
                doc.rect(x, y, cellSize, cellSize);
                doc.setTextColor(160);
                doc.text(char, x + cellSize / 2, y + cellSize / 2, {
                    align: 'center',
                    baseline: 'middle'
                });
                x += cellSize + gap;
            }
            x = margin;
            y += cellSize + gap + 10;
        }

        if (kanjiWords.length > 0) {
            if (y > pageH - margin) {
                doc.addPage();
                y = margin;
            }
            doc.setFontSize(14);
            doc.setTextColor(20, 20, 20);
            doc.text('Luyện viết từ Kanji:', pageW / 2, y, { align: 'center' });
            y += 8;
        }

        for (const word of kanjiWords) {
            const wordFontSize = mmToPt(cellSize * 0.7);

            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            doc.text(word, margin, y - 2);

            for (let i = 0; i < 10; i++) {
                doc.setFontSize(wordFontSize);
                const wordWidthInPoints = doc.getStringUnitWidth(word) * wordFontSize;
                const wordWidthInMm = wordWidthInPoints * 25.4 / 72;

                const wordCellWidth = Math.max(wordWidthInMm, cellSize) + gap;

                if (x + wordCellWidth > pageW - margin) {
                    x = margin;
                    y += cellSize + gap + 10;
                    if (y + cellSize > pageH - margin) {
                        doc.addPage();
                        y = margin + 10;
                    }
                }

                if (y + cellSize > pageH - margin) {
                    doc.addPage();
                    x = margin;
                    y = margin + 10;
                }

                doc.setDrawColor(150);
                doc.rect(x, y, wordCellWidth - gap, cellSize);
                doc.setTextColor(160);
                doc.setFontSize(wordFontSize);
                doc.text(word, x + (wordCellWidth - gap) / 2, y + cellSize / 2, {
                    align: 'center',
                    baseline: 'middle'
                });

                x += wordCellWidth;
            }

            x = margin;
            y += cellSize + gap + 10;
        }

        doc.save('luyen-viet-kanji.pdf');
        return;

    } catch (err) {
        console.error('Lỗi khi tạo PDF với font nhúng:', err);
        showCustomAlert('Không thể tạo PDF bằng font nhúng. Chuyển sang phương án dự phòng.');
        fallbackCanvasExportKanjiWithWords(text);
    }
}

function fallbackCanvasExportKanjiWithWords(text) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const cellSize = 14; // mm
    const gap = 4;
    const scale = 4; // tăng độ nét ảnh

    let x = margin;
    let y = margin + 10;

    // Tách Kanji đơn và từ Kanji
    const uniqueKanjiChars = [...new Set(Array.from(text).filter(isKanji))];
    const kanjiWords = [...new Set(text.match(/[\u4e00-\u9faf]{2,}/g) || [])];

    // Kanji đơn
    uniqueKanjiChars.forEach(char => {
        doc.setFontSize(12);
        y += 8;

        // 1 ô mẫu (chỉ chữ, không khung)
        addSampleImage(char, cellSize, x, y);
        x += cellSize + gap;

        // 19 ô luyện (có khung)
        for (let i = 0; i < 19; i++) {
            if (x + cellSize > pageW - margin) {
                x = margin;
                y += cellSize + gap;
            }
            if (y + cellSize > pageH - margin) {
                doc.addPage();
                x = margin;
                y = margin + 10;
            }

            addPracticeImage(char, cellSize, x, y);
            x += cellSize + gap;
        }

        x = margin;
        y += cellSize + gap + 8;
    });

    // Kanji từ
    kanjiWords.forEach(word => {
        const wordWidth = cellSize * word.length;

        doc.setFontSize(10);

        // 1 ô mẫu (chỉ chữ, không khung)
        addSampleImage(word, wordWidth, x, y);
        x += wordWidth + gap;

        // 5 ô luyện (có khung)
        for (let i = 0; i < 5; i++) {
            if (x + wordWidth > pageW - margin) {
                x = margin;
                y += cellSize + gap;
            }
            if (y + cellSize > pageH - margin) {
                doc.addPage();
                x = margin;
                y = margin + 10;
            }

            addPracticeImage(word, wordWidth, x, y);
            x += wordWidth + gap;
        }

        x = margin;
        y += cellSize + gap + 8;
    });

    doc.save("kanji-practice-fallback.pdf");

    // --- helper: tạo hình ảnh mẫu (chữ không khung) ---
    function addSampleImage(text, width, posX, posY) {
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = cellSize * scale;
        const ctx = canvas.getContext("2d");

        ctx.scale(scale, scale);
        ctx.fillStyle = "#000";
        ctx.font = `${cellSize * 0.6}px 'Noto Sans JP','Yu Gothic','Meiryo',sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, width / 2, cellSize / 2);

        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", posX, posY, width, cellSize);
    }

    // --- helper: tạo hình ảnh luyện tập (có khung + chữ mờ) ---
    function addPracticeImage(text, width, posX, posY) {
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = cellSize * scale;
        const ctx = canvas.getContext("2d");

        ctx.scale(scale, scale);
        ctx.strokeStyle = "#000";
        ctx.strokeRect(0, 0, width, cellSize);

        // chữ mờ rất nhạt
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.font = `${cellSize * 0.6}px 'Noto Sans JP','Yu Gothic','Meiryo',sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, width / 2, cellSize / 2);

        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", posX, posY, width, cellSize);
    }
}

///////////////////////////////
// Text-to-Speech Functions ///
///////////////////////////////

function loadVoices() {
    voices = synth.getVoices();

    const japaneseVoices = voices.filter(voice =>
        voice.lang.includes('ja') || voice.lang.includes('JP')
    );

    if (ttsVoiceSelect) {
        ttsVoiceSelect.innerHTML = '';

        japaneseVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            ttsVoiceSelect.appendChild(option);
        });

        if (japaneseVoices.length === 0 && voices.length > 0) {
            const option = document.createElement('option');
            option.value = voices[0].name;
            option.textContent = `${voices[0].name} (${voices[0].lang})`;
            ttsVoiceSelect.appendChild(option);
        }
    }
}

if (synth) {
    synth.onvoiceschanged = loadVoices;
    loadVoices();
    console.log("Loaded voices:", voices);

    synth.addEventListener('voiceschanged', loadVoices);
}

function unlockAudio() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);

    if (context.state === 'suspended') {
        context.resume();
    }
}

document.addEventListener('click', function () {
    unlockAudio();
}, { once: true });

if (playTtsBtn) {
    playTtsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        unlockAudio();
        setTimeout(() => {
            playTTS();
        }, 100);
    });
}

function checkTTSCompatibility() {
    if (!('speechSynthesis' in window)) {
        const warning = document.createElement('div');
        warning.style.background = '#ffebee';
        warning.style.padding = '10px';
        warning.style.borderRadius = '4px';
        warning.style.margin = '10px 0';
        warning.innerHTML = `
            <strong>⚠️ Trình duyệt không hỗ trợ đầy đủ Text-to-Speech</strong>
            <p>Trên thiết bị di động, vui lòng sử dụng Chrome hoặc Safari mới nhất</p>
        `;

        const ttsContainer = document.querySelector('.tool-section');
        if (ttsContainer) {
            ttsContainer.insertBefore(warning, ttsContainer.firstChild);
        }

        if (playTtsBtn) playTtsBtn.disabled = true;
        if (pauseTtsBtn) pauseTtsBtn.disabled = true;
        if (stopTtsBtn) stopTtsBtn.disabled = true;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    checkTTSCompatibility();

    if ('ontouchstart' in window) {
        document.body.addEventListener('touchstart', unlockAudio, { once: true });
    }
});

function playTTS() {
    if (!ttsText) return;

    const text = ttsText.value.trim();

    if (!text) {
        showCustomAlert('Vui lòng nhập văn bản tiếng Nhật');
        return;
    }

    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();

        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('Audio context resumed');
            });
        }
    }

    sentences = text.split(/(?<=[。．！？!?])/).filter(s => s.trim().length > 0);

    if (ttsTextDisplay) {
        ttsTextDisplay.innerHTML = '';
        sentences.forEach((sentence, index) => {
            const span = document.createElement('span');
            span.id = `sentence-${index}`;
            span.textContent = sentence;
            ttsTextDisplay.appendChild(span);
        });
    }

    if (ttsHighlightContainer) {
        ttsHighlightContainer.classList.remove('hidden');
    }

    if (synth.speaking) {
        synth.cancel();
    }

    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';

    if (ttsSpeed) {
        utterance.rate = parseFloat(ttsSpeed.value);
    }

    if (ttsVoiceSelect && ttsVoiceSelect.value) {
        const voice = voices.find(v => v.name === ttsVoiceSelect.value);
        if (voice) {
            utterance.voice = voice;
        }
    }

    utterance.onboundary = function (event) {
        if (event.name === 'sentence') {
            const previous = document.getElementById(`sentence-${currentSentenceIndex}`);
            if (previous) previous.classList.remove('highlighted');

            currentSentenceIndex = sentences.findIndex(s =>
                event.charIndex >= text.indexOf(s) &&
                event.charIndex < text.indexOf(s) + s.length
            );

            const current = document.getElementById(`sentence-${currentSentenceIndex}`);
            if (current) {
                current.classList.add('highlighted');
                current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    utterance.onend = function () {
        if (playTtsBtn) playTtsBtn.disabled = false;
        if (pauseTtsBtn) pauseTtsBtn.disabled = true;
        if (stopTtsBtn) stopTtsBtn.disabled = true;

        document.querySelectorAll('.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
    };

    synth.speak(utterance);

    if (playTtsBtn) playTtsBtn.disabled = true;
    if (pauseTtsBtn) pauseTtsBtn.disabled = false;
    if (stopTtsBtn) stopTtsBtn.disabled = false;
}

function pauseTTS() {
    if (!synth) return;

    if (synth.speaking && !synth.paused) {
        synth.pause();
        if (pauseTtsBtn) {
            pauseTtsBtn.textContent = 'Tiếp tục';
            pauseTtsBtn.innerHTML = '<i class="fas fa-play"></i> Tiếp tục';
        }
    } else if (synth.paused) {
        synth.resume();
        if (pauseTtsBtn) {
            pauseTtsBtn.textContent = 'Tạm dừng';
            pauseTtsBtn.innerHTML = '<i class="fas fa-pause"></i> Tạm dừng';
        }
    }
}

function stopTTS() {
    if (!synth) return;

    if (synth.speaking) {
        synth.cancel();

        if (playTtsBtn) playTtsBtn.disabled = false;
        if (pauseTtsBtn) pauseTtsBtn.disabled = true;
        if (stopTtsBtn) stopTtsBtn.disabled = true;
        if (pauseTtsBtn) {
            pauseTtsBtn.textContent = 'Tạm dừng';
            pauseTtsBtn.innerHTML = '<i class="fas fa-pause"></i> Tạm dừng';
        }

        document.querySelectorAll('.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (!('speechSynthesis' in window)) {
        showCustomAlert('Trình duyệt của bạn không hỗ trợ chức năng Text-to-Speech. Vui lòng sử dụng Chrome, Edge hoặc Safari.');
        if (playTtsBtn) playTtsBtn.disabled = true;
        if (pauseTtsBtn) pauseTtsBtn.disabled = true;
        if (stopTtsBtn) stopTtsBtn.disabled = true;
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function () {
            if (this.getAttribute('data-tab') === 'tools') {
                if (synth && synth.speaking) {
                    synth.cancel();
                }
            }
        });
    });

    setTimeout(loadVoices, 500);
});