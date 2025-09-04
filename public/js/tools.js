// Tools functionality for writing practice and text-to-speech

// Writing Practice Tool
const writingText = document.getElementById('writing-text');
const generateGridBtn = document.getElementById('generate-grid');
const exportPdfBtn = document.getElementById('export-pdf');
const writingGridContainer = document.getElementById('writing-grid-container');
const writingGrid = document.getElementById('writing-grid');
const exportKanjiPdfBtn = document.getElementById('export-kanji-pdf');

// Text-to-Speech Tool
const ttsVoiceSelect = document.getElementById('tts-voice');
const ttsText = document.getElementById('tts-text');
const ttsSpeed = document.getElementById('tts-speed');
const speedValue = document.getElementById('speed-value');
const playTtsBtn = document.getElementById('play-tts');
const pauseTtsBtn = document.getElementById('pause-tts');
const stopTtsBtn = document.getElementById('stop-tts');
const ttsHighlightContainer = document.getElementById('tts-highlight-container');
const ttsTextDisplay = document.getElementById('tts-text-display');

// Initialize variables
let synth = window.speechSynthesis;
let utterance = null;
let currentSentenceIndex = 0;
let sentences = [];
let voices = [];

// Event Listeners for Writing Practice Tool
generateGridBtn.addEventListener('click', generateWritingGrid);
exportPdfBtn.addEventListener('click', exportToPDF);
exportKanjiPdfBtn.addEventListener('click', exportKanjiPDF);

// Event Listeners for TTS Tool
ttsSpeed.addEventListener('input', updateSpeedValue);
playTtsBtn.addEventListener('click', playTTS);
pauseTtsBtn.addEventListener('click', pauseTTS);
stopTtsBtn.addEventListener('click', stopTTS);

// Speed control update
function updateSpeedValue() {
  const speed = parseFloat(ttsSpeed.value);
  speedValue.textContent = speed.toFixed(1) + 'x';
}

// Generate writing grid from Japanese text
function generateWritingGrid() {
  const text = writingText.value.trim();

  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
  }

  writingGrid.innerHTML = '';

  // Split text into characters (including punctuation and spaces)
  const characters = Array.from(text);

  characters.forEach(char => {
    const cell = document.createElement('div');
    cell.className = 'character-cell';
    cell.textContent = char;
    writingGrid.appendChild(cell);
  });

  writingGridContainer.classList.remove('hidden');
  exportPdfBtn.disabled = false;
  // Kích hoạt nút xuất PDF Kanji
  exportKanjiPdfBtn.disabled = false;
}

// Hàm kiểm tra kích thước văn bản
function checkTextSize(text) {
  const characters = Array.from(text);
  const estimatedPages = Math.ceil(characters.length / 200); // ~200 ký tự/trang

  if (estimatedPages > 10) {
    const confirm = window.confirm(
      `Văn bản của bạn khá dài (khoảng ${estimatedPages} trang). Bạn có muốn tiếp tục không?`
    );
    if (!confirm) return false;
  }

  return true;
}

// Export writing grid to PDF
async function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const text = writingText.value.trim();
  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
  }

  // Helper: convert ArrayBuffer -> base64 string
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
    // ----- 1. Lấy font (tốt nhất host local: /public/assets/fonts/...) -----
    // Nếu bạn host font trong project, đặt đường dẫn tương ứng. Ví dụ:
    // const fontUrl = '/public/assets/fonts/NotoSansJP-Regular.ttf';
    // Nếu dùng CDN, nhiều CDN trả về CORS, có thể bị chặn => tốt nhất tải về host local.
    const fontUrl = '/assets/fonts/NotoSansJP-VariableFont_wght.ttf';

    // Fetch font binary
    const fontResp = await fetch(fontUrl);
    if (!fontResp.ok) throw new Error('Không thể tải font từ ' + fontUrl);
    const fontBuf = await fontResp.arrayBuffer();
    const fontBase64 = arrayBufferToBase64(fontBuf);

    // Thêm font vào jsPDF
    doc.addFileToVFS('NotoSansJP.ttf', fontBase64);
    doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal');
    doc.setFont('NotoSansJP');

    // ----- 2. Thiết lập layout -----
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const topTitleY = 18;

    // Title
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text('Luyện viết tiếng Nhật', pageW / 2, topTitleY, { align: 'center' });

    // Grid config (đơn vị mm)
    const cellSize = 12;          // kích thước ô vuông (mm) — điều chỉnh nếu muốn to/nhỏ
    const gap = 3;                // khoảng cách giữa các ô
    const startX = margin;
    let x = startX;
    let y = topTitleY + 8;       // bắt đầu vẽ grid sau tiêu đề

    // Chọn font-size sao cho vừa với ô: convert mm -> pt
    const mmToPt = mm => mm * 72 / 25.4;
    // Chọn tỉ lệ chữ so với cell (ví dụ 0.7)
    const fontSizePt = mmToPt(cellSize * 0.7);
    doc.setFontSize(fontSizePt);

    // Thêm từng ký tự vào ô
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];

      // Nếu vượt khổ giấy theo chiều ngang thì xuống dòng
      if (x + cellSize > pageW - margin) {
        x = startX;
        y += cellSize + gap;
      }

      // Nếu vượt chiều dọc thì thêm trang mới
      if (y + cellSize > pageH - margin) {
        doc.addPage();
        // reset vị trí (có thể lặp tiêu đề nếu muốn)
        x = startX;
        y = margin;
      }

      // Vẽ ô vuông
      doc.setDrawColor(150);
      doc.rect(x, y, cellSize, cellSize);

      // Viết ký tự ở giữa ô (màu xám nhạt)
      doc.setTextColor(160); // gray
      // kiểu căn giữa theo cả ngang + dọc (baseline: 'middle' hỗ trợ ở jsPDF mới)
      // dùng options { align: 'center', baseline: 'middle' }
      // vị trí là tâm ô: x + cellSize/2, y + cellSize/2
      // note: nếu jsPDF bạn dùng không hỗ trợ 'baseline', thử dùng y + cellSize/2 + font_size_adjustment
      doc.text(ch, x + cellSize / 2, y + cellSize / 2, {
        align: 'center',
        baseline: 'middle'
      });

      // tiếp ô kế
      x += cellSize + gap;
    }

    // Lưu file
    doc.save('luyen-viet-tieng-nhat.pdf');
    return;
  } catch (err) {
    console.error('Lỗi khi tạo PDF với font nhúng:', err);
    alert('Không thể tạo PDF bằng font nhúng. Chuyển sang phương án dự phòng (image).');
    // Nếu lỗi, fallback sang phương pháp canvas -> image
    fallbackCanvasExport(text);
  }
}

// Fallback: render mỗi ô lên canvas rồi addImage vào PDF (không phụ thuộc font jsPDF)
// Tốc độ chậm hơn, file nặng hơn nhưng an toàn khi font không nhúng được.
function fallbackCanvasExport(text) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cellSize = 12;
  const gap = 3;

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

    // tạo canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cellSize * 3);  // scale to get decent resolution (mm->px approx)
    canvas.height = Math.round(cellSize * 3);
    const ctx = canvas.getContext('2d');

    // background (transparent) + border
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    // chữ nhật xám nhạt
    ctx.fillStyle = '#C8C8C8';
    // chọn font hệ thống có hỗ trợ JP (nếu client có) — fallback sẽ hiển thị đúng nếu browser có font
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

console.log("Font fetch URL:", fontUrl);

// Kiểm tra hỗ trợ font tiếng Nhật
function checkJapaneseFontSupport() {
  const testText = '日本語';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const fonts = [
    'MS Gothic',
    'Hiragino Sans',
    'Noto Sans JP',
    'Yu Gothic',
    'Meiryo',
    'sans-serif'
  ];

  ctx.font = '16px sans-serif';
  const defaultWidth = ctx.measureText(testText).width;

  for (const font of fonts) {
    ctx.font = `16px "${font}"`;
    const width = ctx.measureText(testText).width;

    if (width !== defaultWidth) {
      console.log(`Font ${font} hỗ trợ tiếng Nhật`);
      return font;
    }
  }

  console.log('Không tìm thấy font tiếng Nhật nào');
  return null;
}

// Sử dụng trong hàm export
const supportedFont = checkJapaneseFontSupport();
if (supportedFont) {
  doc.setFont(supportedFont);
}

// Hàm kiểm tra xem ký tự có phải là Kanji không
function isKanji(char) {
  const code = char.charCodeAt(0);
  // Kanji nằm trong khoảng Unicode: 0x4E00 - 0x9FAF
  return code >= 0x4E00 && code <= 0x9FAF;
}

async function exportKanjiPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const text = writingText.value.trim();
  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
  }

  // Helper functions
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

  // Trích xuất các chữ Kanji đơn lẻ không trùng lặp
  const uniqueKanjiChars = [...new Set(Array.from(text).filter(isKanji))];

  // Trích xuất các từ Kanji (ít nhất 2 chữ Kanji đi liền nhau)
  const kanjiWords = [...new Set(text.match(/[\u4e00-\u9faf]{2,}/g) || [])];

  // Nếu không tìm thấy cả chữ Kanji đơn lẻ và từ Kanji
  if (uniqueKanjiChars.length === 0 && kanjiWords.length === 0) {
    alert('Không tìm thấy chữ hoặc từ Kanji trong văn bản.');
    return;
  }

  try {
    // 1. Lấy và nhúng font
    const fontUrl = '/public/assets/fonts/NotoSansJP-VariableFont_wght.ttf';
    const fontResp = await fetch(fontUrl);
    if (!fontResp.ok) throw new Error('Không thể tải font từ ' + fontUrl);
    const fontBuf = await fontResp.arrayBuffer();
    const fontBase64 = arrayBufferToBase64(fontBuf);
    doc.addFileToVFS('NotoSansJP.ttf', fontBase64);
    doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal');
    doc.setFont('NotoSansJP');

    // 2. Thiết lập layout
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const cellSize = 12;
    const gap = 3;
    const titleYOffset = 10;

    let x = margin;
    let y = margin;

    // ----- Bổ sung: In toàn bộ văn bản đã nhập -----
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text('Văn bản đã nhập:', pageW / 2, y, { align: 'center' });
    y += 8;

    const textLines = doc.splitTextToSize(text, pageW - 2 * margin);
    doc.setFontSize(10);
    doc.text(textLines, margin, y);
    y += (textLines.length * 5) + 10;
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    // --------------------------------------------------

    // 3. Lặp qua từng chữ Kanji đơn lẻ để tạo trang luyện viết
    const mmToPt = mm => mm * 72 / 25.4;

    for (const char of uniqueKanjiChars) {
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text(`Luyện viết chữ: ${char}`, pageW / 2, y, { align: 'center' });
      y += titleYOffset;

      doc.setFontSize(mmToPt(cellSize * 0.7)); // Đặt font size cho ô vuông

      for (let i = 0; i < 10; i++) {
        // Kiểm tra vị trí để xuống dòng hoặc thêm trang mới
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

        // Vẽ ô vuông và in chữ mờ
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

    // 4. Bổ sung: Lặp qua từng từ Kanji để tạo trang luyện viết
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

      // Tên từ được in ngay trên dòng luyện viết
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(word, margin, y - 2);

      // Vẽ 10 ô cho mỗi từ
      for (let i = 0; i < 10; i++) {
        // Tính toán chiều rộng của từ
        doc.setFontSize(wordFontSize);
        const wordWidthInPoints = doc.getStringUnitWidth(word) * wordFontSize;
        const wordWidthInMm = wordWidthInPoints * 25.4 / 72;

        // Chiều rộng ô sẽ là chiều rộng từ + khoảng cách hoặc chiều rộng ô đơn + khoảng cách
        const wordCellWidth = Math.max(wordWidthInMm, cellSize) + gap;

        if (x + wordCellWidth > pageW - margin) {
          x = margin;
          y += cellSize + gap + 10;
          // Nếu xuống dòng mới, cần kiểm tra lại xem có đủ chỗ không
          if (y + cellSize > pageH - margin) {
            doc.addPage();
            y = margin + 10;
          }
        }

        // Nếu trang mới, in lại tiêu đề từ
        if (y + cellSize > pageH - margin) {
          doc.addPage();
          x = margin;
          y = margin + 10;
        }

        // Vẽ ô chữ nhật bao toàn bộ từ
        doc.setDrawColor(150);
        doc.rect(x, y, wordCellWidth - gap, cellSize); // trừ gap để không bị thừa
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
    alert('Không thể tạo PDF bằng font nhúng. Chuyển sang phương án dự phòng.');
    // Fallback nếu có lỗi
    fallbackCanvasExportKanjiWithWords(text);
  }
}

// Hàm fallback mới có thêm chức năng in từ Kanji
function fallbackCanvasExportKanjiWithWords(text) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cellSize = 12;
  const gap = 3;
  const charsPerRow = 10;

  let x = margin;
  let y = 15;

  // In văn bản đã nhập
  doc.setFontSize(14);
  doc.text('Văn bản đã nhập:', pageW / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  const textLines = doc.splitTextToSize(text, pageW - 2 * margin);
  doc.text(textLines, margin, y);
  y += (textLines.length * 5) + 10;
  if (y > pageH - margin) {
    doc.addPage();
    y = margin;
  }

  const uniqueKanjiChars = [...new Set(Array.from(text).filter(isKanji))];
  const kanjiWords = [...new Set(text.match(/[\u4e00-\u9faf]{2,}/g) || [])];

  uniqueKanjiChars.forEach(char => {
    doc.setFontSize(14);
    doc.text(`Luyện viết chữ: ${char}`, pageW / 2, y, { align: 'center' });
    y += 10;

    for (let i = 0; i < 10; i++) {
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
      ctx.fillText(char, canvas.width / 2, canvas.height / 2);

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', x, y, cellSize, cellSize);
      x += cellSize + gap;
    }
    x = margin;
    y += cellSize + gap + 10;
  });

  kanjiWords.forEach(word => {
    const wordFontSize = mmToPt(cellSize * 0.7);
    // Tên từ được in ngay trên dòng luyện viết
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(word, margin, y - 2);

    for (let i = 0; i < 10; i++) {
      // Tính toán chiều rộng của từ
      doc.setFontSize(wordFontSize);
      const wordWidthInPoints = doc.getStringUnitWidth(word) * wordFontSize;
      const wordWidthInMm = wordWidthInPoints * 25.4 / 72;

      // Chiều rộng ô sẽ là chiều rộng từ + khoảng cách hoặc chiều rộng ô đơn + khoảng cách
      const wordCellWidth = Math.max(wordWidthInMm, cellSize) + gap;
      if (x + wordCellWidth > pageW - margin) {
        x = margin;
        y += cellSize + gap + 10;
        // Nếu xuống dòng mới, cần kiểm tra lại xem có đủ chỗ không
        if (y + cellSize > pageH - margin) {
          doc.addPage();
          y = margin + 10;
        }
      }

      // Nếu trang mới, in lại tiêu đề từ
      if (y + cellSize > pageH - margin) {
        doc.addPage();
        x = margin;
        y = margin + 10;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(wordCellWidth * 3);
      canvas.height = Math.round(cellSize * 3);
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      ctx.fillStyle = '#C8C8C8';
      ctx.font = `${Math.round(canvas.height * 0.6)}px "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, canvas.width / 2, canvas.height / 2);
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', x, y, wordCellWidth, cellSize);
      x += wordCellWidth;
    }
    x = margin;
    y += cellSize + gap + 10;
  });

  doc.save('luyen-viet-kanji-fallback.pdf');
}

///////////////////////////////
// Text-to-Speech Functions ///
///////////////////////////////

// Hàm lấy danh sách giọng đọc
function loadVoices() {
  voices = synth.getVoices();
  if (voices.length === 0) {
    // Trên iOS có thể load chậm, cần gọi lại sau một chút
    setTimeout(loadVoices, 500);
    return;
  }

  ttsVoiceSelect.innerHTML = '';
  voices.forEach((voice, i) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    ttsVoiceSelect.appendChild(option);
  });
}

synth.onvoiceschanged = loadVoices;
loadVoices();
console.log("Loaded voices:", voices);

// Sự kiện khi voices được load
synth.addEventListener('voiceschanged', loadVoices);

// Hàm mở khóa audio trên mobile
function unlockAudio() {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = context.createBuffer(1, 1, 22050);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
  
  // Kiểm tra và resume nếu bị suspended
  if (context.state === 'suspended') {
    context.resume();
  }
}

// Gọi hàm unlock khi có user interaction
document.addEventListener('click', function() {
  unlockAudio();
}, { once: true }); // Chỉ cần gọi một lần

// Thay đổi cách gắn event listener
playTtsBtn.addEventListener('click', function(e) {
  // Đảm bảo đây là user gesture
  e.preventDefault();
  
  // Unlock audio trước khi play
  unlockAudio();
  
  // Small delay để đảm bảo audio context ready
  setTimeout(() => {
    playTTS();
  }, 100);
});

// Thêm hàm kiểm tra compatibility
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
    
    playTtsBtn.disabled = true;
    pauseTtsBtn.disabled = true;
    stopTtsBtn.disabled = true;
  }
}

// Gọi hàm kiểm tra khi load
document.addEventListener('DOMContentLoaded', function() {
  checkTTSCompatibility();
  
  // Thêm touch event cho mobile
  if ('ontouchstart' in window) {
    document.body.addEventListener('touchstart', unlockAudio, { once: true });
  }
});

function playTTS() {
  const text = ttsText.value.trim();

  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
  }

  // Tạo audio context nếu chưa có (cho mobile)
  if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Resume audio context khi có user interaction
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('Audio context resumed');
      });
    }
  }

  // Split text into sentences (using Japanese punctuation)
  sentences = text.split(/(?<=[。．！？!?])/).filter(s => s.trim().length > 0);

  // Display text with highlighting container
  ttsTextDisplay.innerHTML = '';
  sentences.forEach((sentence, index) => {
    const span = document.createElement('span');
    span.id = `sentence-${index}`;
    span.textContent = sentence;
    ttsTextDisplay.appendChild(span);
  });

  ttsHighlightContainer.classList.remove('hidden');

  // Setup speech synthesis
  if (synth.speaking) {
    synth.cancel();
  }

  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = parseFloat(ttsSpeed.value);

  // Chọn giọng đọc
  const selectedVoice = ttsVoiceSelect.value;
  if (selectedVoice) {
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }
  }

  // Highlight current sentence as it's being spoken
  utterance.onboundary = function (event) {
    if (event.name === 'sentence') {
      // Remove highlight from previous sentence
      const previous = document.getElementById(`sentence-${currentSentenceIndex}`);
      if (previous) previous.classList.remove('highlighted');

      // Find current sentence index
      currentSentenceIndex = sentences.findIndex(s =>
        event.charIndex >= text.indexOf(s) &&
        event.charIndex < text.indexOf(s) + s.length
      );

      // Highlight current sentence
      const current = document.getElementById(`sentence-${currentSentenceIndex}`);
      if (current) {
        current.classList.add('highlighted');
        // Scroll to highlighted sentence
        current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  utterance.onend = function () {
    playTtsBtn.disabled = false;
    pauseTtsBtn.disabled = true;
    stopTtsBtn.disabled = true;

    // Remove all highlights
    document.querySelectorAll('.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
  };

  synth.speak(utterance);

  // Update button states
  playTtsBtn.disabled = true;
  pauseTtsBtn.disabled = false;
  stopTtsBtn.disabled = false;
}

function pauseTTS() {
  if (synth.speaking && !synth.paused) {
    synth.pause();
    pauseTtsBtn.textContent = 'Tiếp tục';
    pauseTtsBtn.innerHTML = '<i class="fas fa-play"></i> Tiếp tục';
  } else if (synth.paused) {
    synth.resume();
    pauseTtsBtn.textContent = 'Tạm dừng';
    pauseTtsBtn.innerHTML = '<i class="fas fa-pause"></i> Tạm dừng';
  }
}

function stopTTS() {
  if (synth.speaking) {
    synth.cancel();

    // Update button states
    playTtsBtn.disabled = false;
    pauseTtsBtn.disabled = true;
    stopTtsBtn.disabled = true;
    pauseTtsBtn.textContent = 'Tạm dừng';
    pauseTtsBtn.innerHTML = '<i class="fas fa-pause"></i> Tạm dừng';

    // Remove all highlights
    document.querySelectorAll('.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
  }
}

// Initialize tools when the tab is activated
document.addEventListener('DOMContentLoaded', function () {
  // Check if browser supports SpeechSynthesis
  if (!('speechSynthesis' in window)) {
    alert('Trình duyệt của bạn không hỗ trợ chức năng Text-to-Speech. Vui lòng sử dụng Chrome, Edge hoặc Safari.');
    playTtsBtn.disabled = true;
    pauseTtsBtn.disabled = true;
    stopTtsBtn.disabled = true;
  }

  // Add tab event listener for tools tab
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function () {
      if (this.getAttribute('data-tab') === 'tools') {
        // Stop any ongoing speech when switching to tools tab
        if (synth.speaking) {
          synth.cancel();
        }
      }
    });
  });
  // Load voices sau một khoảng thời gian ngắn để đảm bảo API đã sẵn sàng
  setTimeout(loadVoices, 500);
});