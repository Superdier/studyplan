// Tools functionality for writing practice and text-to-speech

// Writing Practice Tool
const writingText = document.getElementById('writing-text');
const generateGridBtn = document.getElementById('generate-grid');
const exportPdfBtn = document.getElementById('export-pdf');
const writingGridContainer = document.getElementById('writing-grid-container');
const writingGrid = document.getElementById('writing-grid');

// Text-to-Speech Tool
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

// Event Listeners for Writing Practice Tool
generateGridBtn.addEventListener('click', generateWritingGrid);
exportPdfBtn.addEventListener('click', exportToPDF);

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
// Thay thế exportToPDF bằng hàm này
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
    const fontUrl = '/public/assets/fonts/NotoSansJP-VariableFont_wght.ttf'; // <-- chỉnh theo vị trí font của bạn

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

////////// KANJI //////////
// Thêm event listener cho nút xuất PDF Kanji
document.getElementById('export-kanji-pdf').addEventListener('click', exportKanjiPDF);

// Dữ liệu mẫu về số nét của các chữ Kanji thông dụng
const kanjiStrokeData = {
  '勉': 10,
  '強': 11,
  '日': 4,
  '本': 5,
  '語': 14,
  '学': 8,
  '習': 11,
  '漢': 13,
  '字': 6,
  '先': 6,
  '生': 5
  // Có thể thêm nhiều chữ Kanji khác tại đây
};

// Hàm kiểm tra xem ký tự có phải là Kanji không
function isKanji(char) {
  const code = char.charCodeAt(0);
  // Kanji nằm trong khoảng Unicode: 0x4E00 - 0x9FAF
  return code >= 0x4E00 && code <= 0x9FAF;
}

// Hàm xuất PDF hướng dẫn viết Kanji từng nét
// Biến lưu trữ dữ liệu Kanji
let kanjiData = {};

// Event listener cho nút tải dữ liệu Kanji
document.getElementById('fetch-kanji-data').addEventListener('click', fetchKanjiData);

// Hàm gọi API để lấy thông tin Kanji
async function fetchKanjiData() {
  const text = writingText.value.trim();
  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
  }

  // Hiển thị loading
  document.getElementById('loading-indicator').classList.remove('hidden');
  document.getElementById('kanji-info-container').classList.add('hidden');

  try {
    // Tách các chữ Kanji từ văn bản
    const kanjiCharacters = extractKanjiCharacters(text);

    if (kanjiCharacters.length === 0) {
      alert('Không tìm thấy chữ Kanji trong văn bản');
      return;
    }

    // Lấy dữ liệu cho từng chữ Kanji
    for (const character of kanjiCharacters) {
      if (!kanjiData[character]) {
        kanjiData[character] = await getKanjiData(character);

        // Đợi một chút giữa các request để tránh bị chặn
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Hiển thị thông tin Kanji
    displayKanjiInfo(kanjiCharacters);

  } catch (error) {
    console.error('Lỗi khi tải dữ liệu Kanji:', error);
    alert('Có lỗi xảy ra khi tải dữ liệu Kanji. Vui lòng thử lại.');
  } finally {
    // Ẩn loading
    document.getElementById('loading-indicator').classList.add('hidden');
  }
}

// Hàm trích xuất chữ Kanji từ văn bản
function extractKanjiCharacters(text) {
  // Biểu thức chính quy để tìm chữ Hán (Kanji)
  const kanjiRegex = /[\u4E00-\u9FAF]/g;
  const matches = text.match(kanjiRegex);

  if (!matches) return [];

  // Lọc các ký tự trùng lặp
  return [...new Set(matches)];
}

// Hàm gọi API Jisho.org để lấy thông tin Kanji
async function getKanjiData(kanji) {
  try {
    const response = await fetch(`/api/kanji?keyword=${kanji}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Tìm thông tin chi tiết về chữ Kanji
    // Dữ liệu kanji nằm ở item đầu tiên của mảng data
    const kanjiResult = data.data.find(item => item.is_common === true || item.tags.includes('common'));
    const singleKanjiResult = data.data.find(item => item.slug === kanji);

    let result = kanjiResult || singleKanjiResult || data.data[0];

    if (result) {
      // Lấy các cách đọc On và Kun từ các trường sense
      const kunReadings = result.senses.reduce((acc, sense) => {
        const readings = sense.tags.filter(tag => tag.includes('kun') && !acc.includes(tag));
        return acc.concat(readings);
      }, []).map(r => r.replace(/.*-reading|kun-reading/g, '').trim());

      const onReadings = result.senses.reduce((acc, sense) => {
        const readings = sense.tags.filter(tag => tag.includes('on') && !acc.includes(tag));
        return acc.concat(readings);
      }, []).map(r => r.replace(/.*-reading|on-reading/g, '').trim());

      // Lấy nghĩa tiếng Anh
      const meanings = result.senses.length > 0 ? result.senses[0].english_definitions : [];

      // Lấy số nét từ dữ liệu chính (nếu có) hoặc ước lượng
      const stroke_count = result.kanji ? result.kanji.stroke_count : estimateStrokeCount(kanji);

      return {
        character: kanji,
        stroke_count: stroke_count,
        meanings: meanings,
        readings: [...kunReadings, ...onReadings],
        kun_readings: kunReadings,
        on_readings: onReadings
      };
    }

    // Fallback nếu không tìm thấy thông tin chi tiết
    return {
      character: kanji,
      stroke_count: estimateStrokeCount(kanji),
      meanings: [],
      readings: [],
      kun_readings: [],
      on_readings: []
    };

  } catch (error) {
    console.error(`Lỗi khi lấy dữ liệu cho chữ ${kanji}:`, error);

    // Trả về dữ liệu mặc định nếu có lỗi
    return {
      character: kanji,
      stroke_count: estimateStrokeCount(kanji),
      meanings: [],
      readings: [],
      kun_readings: [],
      on_readings: []
    };
  }
}


// Hàm ước lượng số nét dựa trên độ phức tạp của chữ Kanji
function estimateStrokeCount(kanji) {
  // Bảng ước lượng số nét dựa trên độ phức tạp
  const complexityMap = {
    '一': 1, '二': 2, '三': 3, '四': 5, '五': 4,
    '六': 4, '七': 2, '八': 2, '九': 2, '十': 2,
    '百': 6, '千': 3, '万': 3, '円': 4, '日': 4,
    '月': 4, '火': 4, '水': 4, '木': 4, '金': 8,
    '土': 3, '本': 5, '人': 2, '友': 4, '先生': 6,
    '学生': 8, '学校': 8, '大学': 8, '医院': 9
  };

  return complexityMap[kanji] || Math.min(8 + Math.floor(kanji.length * 2), 20);
}

// Hàm hiển thị thông tin Kanji
function displayKanjiInfo(kanjiCharacters) {
  const container = document.getElementById('kanji-details');
  container.innerHTML = '';

  for (const character of kanjiCharacters) {
    const data = kanjiData[character];
    if (!data) continue;

    const detailDiv = document.createElement('div');
    detailDiv.className = 'kanji-detail';

    detailDiv.innerHTML = `
            <div>
                <span class="kanji-character">${data.character}</span>
                <span class="kanji-meaning">${data.meanings.join(', ') || 'Không có nghĩa'}</span>
            </div>
            <div class="kanji-reading">
                Âm On: ${data.on_readings.join(', ') || 'N/A'}<br>
                Âm Kun: ${data.kun_readings.join(', ') || 'N/A'}<br>
                Số nét: ${data.stroke_count}
            </div>
            <div class="stroke-diagram">
                ${Array.from({ length: data.stroke_count }, (_, i) =>
      `<div class="stroke-step">${i + 1}</div>`
    ).join('')}
            </div>
        `;

    container.appendChild(detailDiv);
  }

  document.getElementById('kanji-info-container').classList.remove('hidden');
}

// Cập nhật hàm exportKanjiPDF để sử dụng dữ liệu từ API
async function exportKanjiPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const text = writingText.value.trim();
  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
  }

  // Kiểm tra xem đã tải dữ liệu Kanji chưa
  const kanjiCharacters = extractKanjiCharacters(text);
  const hasKanjiData = kanjiCharacters.every(char => kanjiData[char]);

  if (!hasKanjiData) {
    const shouldFetch = confirm('Bạn chưa tải dữ liệu Kanji. Có muốn tải trước khi xuất PDF không?');
    if (shouldFetch) {
      await fetchKanjiData();
    }
  }

  // Tiêu đề
  doc.setFontSize(16);
  doc.text('Hướng dẫn viết chữ Kanji', 105, 15, { align: 'center' });
  doc.setFontSize(12);

  // Tách văn bản thành các từ Kanji
  const words = text.split(/[ 、\s]+/).filter(word => word.length > 0);

  let yPosition = 25;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;
  const cellSize = 8;
  const spacing = 2;

  for (const word of words) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Tiêu đề cho từ
    doc.setFontSize(14);
    doc.text(`Từ: ${word}`, margin, yPosition);
    yPosition += 8;

    // Tách từ thành các chữ Kanji riêng lẻ
    const characters = Array.from(word);

    for (const char of characters) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Lấy thông tin Kanji từ dữ liệu đã tải
      const kanjiInfo = kanjiData[char] || {
        character: char,
        stroke_count: estimateStrokeCount(char),
        meanings: []
      };

      doc.setFontSize(12);
      doc.text(`Chữ: ${char} (Số nét: ${kanjiInfo.stroke_count})`, margin, yPosition);
      yPosition += 6;

      // Tạo các ô cho từng nét
      let xPosition = margin;
      for (let i = 1; i <= kanjiInfo.stroke_count; i++) {
        if (xPosition + cellSize > pageWidth - margin) {
          xPosition = margin;
          yPosition += cellSize + spacing;

          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
            xPosition = margin;
          }
        }

        // Vẽ ô cho nét
        doc.rect(xPosition, yPosition, cellSize, cellSize);

        // Thêm số thứ tự nét
        doc.setFontSize(6);
        doc.text(i.toString(), xPosition + 1, yPosition + 4);

        xPosition += cellSize + spacing;
      }

      yPosition += cellSize + 8;

      // Ô luyện viết cho chữ Kanji (làm mờ)
      doc.setFontSize(12);
      doc.setTextColor(200, 200, 200);
      doc.text(char, margin, yPosition);
      doc.setTextColor(0, 0, 0);

      // Vẽ ô xung quanh chữ
      const charWidth = doc.getTextWidth(char);
      doc.rect(margin, yPosition - 8, charWidth + 2, 10);

      yPosition += 15;
    }

    // Ô luyện viết cho cả từ (làm mờ)
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.text(word, margin, yPosition);
    doc.setTextColor(0, 0, 0);

    // Vẽ ô xung quanh từ
    const wordWidth = doc.getTextWidth(word);
    doc.rect(margin, yPosition - 8, wordWidth + 2, 10);

    yPosition += 20;
  }

  // Lưu file PDF
  doc.save('huong-dan-viet-kanji.pdf');
}

// Hàm hiển thị xem trước hướng dẫn viết Kanji
function showKanjiPreview() {
  const text = writingText.value.trim();
  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
  }

  // Tạo container cho preview
  const previewContainer = document.createElement('div');
  previewContainer.className = 'kanji-preview';
  previewContainer.innerHTML = '<h3>Xem trước hướng dẫn viết Kanji</h3>';

  // Tách văn bản thành các từ
  const words = text.split(/[ 、\s]+/).filter(word => word.length > 0);

  // Duyệt qua từng từ
  for (const word of words) {
    const wordDiv = document.createElement('div');
    wordDiv.className = 'stroke-order';

    wordDiv.innerHTML = `<div class="stroke-header">Từ: ${word}</div>`;

    // Tách từ thành các chữ Kanji riêng lẻ
    const characters = Array.from(word);

    // Duyệt qua từng chữ Kanji
    for (const char of characters) {
      // Bỏ qua nếu không phải Kanji
      if (!isKanji(char)) continue;
      const strokeCount = kanjiStrokeData[char] || 8;

      const kanjiDiv = document.createElement('div');
      kanjiDiv.className = 'stroke-kanji';

      kanjiDiv.innerHTML = `
                <div class="stroke-header">Chữ: ${char} (Số nét: ${strokeCount})</div>
                <div class="stroke-grid">
                    ${Array.from({ length: strokeCount }, (_, i) =>
        `<div class="stroke-cell">${i + 1}</div>`
      ).join('')}
                </div>
                <div class="stroke-header">Luyện viết:</div>
                <div class="stroke-grid">
                    <div class="practice-cell">${char}</div>
                </div>
            `;

      wordDiv.appendChild(kanjiDiv);
    }

    // Thêm phần luyện viết cả từ
    wordDiv.innerHTML += `
            <div class="stroke-header">Luyện viết cả từ:</div>
            <div class="stroke-grid">
                <div class="practice-cell">${word}</div>
            </div>
        `;

    previewContainer.appendChild(wordDiv);
  }

  // Hiển thị preview trong modal hoặc cửa sổ mới
  const previewWindow = window.open('', '_blank', 'width=800,height=600');
  previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Xem trước hướng dẫn viết Kanji</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .kanji-preview { max-width: 100%; }
                .stroke-order { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                .stroke-header { font-weight: bold; margin-bottom: 10px; color: #333; }
                .stroke-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 15px; }
                .stroke-cell, .practice-cell { 
                    width: 35px; height: 35px; border: 1px solid #ddd; 
                    display: flex; align-items: center; justify-content: center; 
                }
                .stroke-cell { font-size: 14px; background-color: #f9f9f9; }
                .practice-cell { font-size: 20px; color: #ccc; background-color: #fff; }
            </style>
        </head>
        <body>
            <h2>Xem trước hướng dẫn viết Kanji</h2>
            ${previewContainer.innerHTML}
            <div style="margin-top: 20px;">
                <button onclick="window.print()">In trang</button>
                <button onclick="window.close()">Đóng</button>
            </div>
        </body>
        </html>
    `);
  previewWindow.document.close();
}

// Thêm nút xem trước
const previewBtn = document.createElement('button');
previewBtn.textContent = 'Xem trước Kanji';
previewBtn.className = 'btn btn-secondary';
previewBtn.style.marginLeft = '10px';
previewBtn.onclick = showKanjiPreview;
document.getElementById('export-kanji-pdf').parentNode.appendChild(previewBtn);

///////////////////////////////
// Text-to-Speech Functions ///
///////////////////////////////
function playTTS() {
  const text = ttsText.value.trim();

  if (!text) {
    alert('Vui lòng nhập văn bản tiếng Nhật');
    return;
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
});