# Studyplan - Hệ Thống Quản Lý Chặng Học Tập

**Phiên Bản**: 2.0 (với Phase Management System)  
**Cập Nhật**: 08/12/2025  
**Trạng Thái**: ✅ Sẵn dùng

## 📌 Tổng Quan

Studyplan là ứng dụng quản lý kế hoạch học tập cá nhân, được thiết kế đặc biệt cho những người học tiếng Nhật, đặc biệt là những người chuẩn bị thi JLPT.

**Tính năng chính**:
- 📅 Lịch học theo tuần với quản lý nhiệm vụ
- 📊 Theo dõi tiến độ & thống kê (tỷ lệ hoàn thành, chuỗi, giờ học)
- 🏷️ **[MỚI]** Quản lý "chặng" (phases) học tập - chia học tập thành các giai đoạn
- 📦 **[MỚI]** Lưu trữ tự động chặng cũ & xem lịch sử
- 🔀 **[MỚI]** Cách ly dữ liệu hoàn toàn giữa các chặng
- 📚 Quản lý tài nguyên (sách giáo khoa, website)
- 🔤 Grid viết chữ Kanji interactiv
- 🗣️ Công cụ text-to-speech cho tiếng Nhật
- ⏱️ Bộ đếm thời gian và nhắc nhở nghỉ ngơi
- 📱 Giao diện responsive cho desktop & mobile

---

## 🎯 Tính Năng Mới - Phase Management v2.0

### **Vấn Đề Được Giải Quyết**
> Trước đây, khi chuyển sang chặng học tập mới, dữ liệu chặng cũ vẫn hiển thị. Giờ đã được sửa!

### **Giải Pháp**
✅ Mỗi chặng có dữ liệu **hoàn toàn riêng biệt**  
✅ Chuyển chặng → Dữ liệu cũ tự động ẩn  
✅ Lưu trữ chặng → Snapshot tự động được tạo  
✅ Xem lịch sử → Dữ liệu chặng cũ được lưu trữ

### **Cách Sử Dụng**
1. **Tạo Chặng**: Nút "Quản Lý" → Tạo chặng mới
2. **Thêm Dữ Liệu**: Lịch, điểm số, buổi học bình thường
3. **Tạo Chặng Tiếp Theo**: Quản Lý → Tạo chặng mới
4. **Chuyển Sang**: Quản Lý → Sử Dụng chặng mới
5. **Lưu Trữ**: Quản Lý → Lưu Trữ chặng cũ

---

## 📖 Tài Liệu

Hệ thống này có **7 tệp tài liệu** để giúp bạn:

### **Cho Người Dùng** 👥
1. **[QUICK_START.md](./QUICK_START.md)** - Bắt đầu nhanh (2-5 phút)
2. **[PHASE_MANAGEMENT_GUIDE.md](./PHASE_MANAGEMENT_GUIDE.md)** - Hướng dẫn chi tiết (15-20 phút)

### **Cho Kỹ Thuật** 🔧
1. **[SYSTEM_CONFIGURATION_CHECK.md](./SYSTEM_CONFIGURATION_CHECK.md)** - Kiểm tra & xử lý (20-30 phút)
2. **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Danh sách triển khai (10-15 phút)

### **Cho Nhà Phát Triển** 👨‍💻
1. **[TECHNICAL_CHANGES_SUMMARY.md](./TECHNICAL_CHANGES_SUMMARY.md)** - Chi tiết kỹ thuật (20-30 phút)

### **Tóm Tắt & Chỉ Mục**
1. **[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** - Tóm tắt hoàn thành (5-10 phút)
2. **[INDEX.md](./INDEX.md)** - Chỉ mục tài liệu (5 phút)

👉 **Bạn nên bắt đầu với [QUICK_START.md](./QUICK_START.md)**

---

## 🚀 Bắt Đầu Nhanh

### **1. Cài Đặt**
```bash
git clone https://github.com/Superdier/studyplan.git
cd studyplan
# Mở index.html hoặc sử dụng live-server
live-server --port=3000
```

### **2. Tạo Chặng Đầu Tiên**
- Mở ứng dụng
- Nhấp nút **"Quản Lý"** (góc trên cùng)
- Nhập tên chặng, ngày bắt đầu, ngày kết thúc
- Nhấp **"Tạo Chặng"**

### **3. Thêm Dữ Liệu**
- Quay lại trang chính
- Thêm lịch, điểm số, buổi học bình thường

### **4. Chuyển Sang Chặng Tiếp Theo**
- Quản Lý → Tạo chặng 2 → Sử Dụng
- Dữ liệu chặng 1 tự động ẩn ✅

---

## 🏗️ Cấu Trúc Thư Mục

```
studyplan/
├── public/
│   ├── index.html                 # Trang chính
│   ├── admin.html                 # Trang Quản Lý [MỚI]
│   ├── archiveHistory.html        # Trang Xem Lưu Trữ [MỚI]
│   ├── css/
│   │   ├── style.css
│   │   └── tools.css
│   ├── js/
│   │   ├── script.js              # Chính (cập nhật v2.0)
│   │   ├── admin.js               # Quản lý chặng [MỚI]
│   │   ├── archiveHistory.js      # Xem lưu trữ [MỚI]
│   │   └── tools.js
│   └── assets/
│       └── fonts/
├── firebase.json                  # Cấu hình Firebase
├── database.rules.json            # Rules Firebase
├── package.json
├── README.md                       # TÀI LIỆU NÀY
├── QUICK_START.md                 # Bắt đầu nhanh [MỚI]
├── PHASE_MANAGEMENT_GUIDE.md      # Hướng dẫn chi tiết [MỚI]
├── SYSTEM_CONFIGURATION_CHECK.md  # Kiểm tra & xử lý [MỚI]
├── TECHNICAL_CHANGES_SUMMARY.md   # Chi tiết kỹ thuật [MỚI]
├── DEPLOYMENT_CHECKLIST.md        # Danh sách triển khai [MỚI]
├── COMPLETION_SUMMARY.md          # Tóm tắt [MỚI]
└── INDEX.md                       # Chỉ mục [MỚI]
```

## Technologies Used
- HTML, CSS, JavaScript
- Chart.js for statistics and charts
- Firebase Realtime Database for data storage
- jsPDF for PDF export

## Statistics & Charts Logic
The statistics page provides a visual overview of your study progress using several interactive charts:

- **Weekly Progress Chart**: Combines a bar and line chart to show both the total study hours per week (bar, in hours) and the completion rate of tasks (line, in %). Data is aggregated from all tasks and sessions for each week.

- **Skill Radar Chart**: Displays the distribution of study time across different language skills (e.g., vocabulary, grammar, kanji, reading, listening, conversation) or by subject (Language, IT, Other). The chart can be filtered to show either all subjects or a specific subject's skill breakdown. Percentages are calculated based on the total time spent on each skill/subject.

- **Time Distribution Chart**: A doughnut chart visualizing how your study time is divided among subjects (Language, IT, Other) or among task types within a subject. The filter allows you to switch between overall subject distribution and detailed task-type breakdowns. Data is based on the total minutes logged for each category.

- **Task Categories**: A visual list of all types of tasks you have completed, grouped by subject and skill/type. Each category shows the number of tasks and total time spent, helping you identify your focus areas.

- **Effective Study Time**: Compares the total study time calculated from completed tasks versus time tracked by the countdown timer (study sessions), both for today and the current week. This helps you see the difference between planned and actual study time.

- **Streaks & Records**: Displays your current and maximum streak of consecutive study days, motivating you to maintain consistent study habits.

All charts are updated in real-time as you log new tasks or study sessions. Data is stored and aggregated using Firebase Realtime Database.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License
This project is licensed under the MIT License.

## Author
Superdier

---
For questions or feedback, please open an issue on GitHub.
