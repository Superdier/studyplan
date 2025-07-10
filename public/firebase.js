import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

// Cấu hình Firebase
const firebaseConfig = {
  "apiKey": "AIzaSyAm9LVPsnm93gDB6MR8ereMzVuCwrGrxfk",
  "authDomain": "tt-studyplan.firebaseapp.com",
  "databaseURL": "https://tt-studyplan-default-rtdb.firebaseio.com",
  "projectId": "tt-studyplan",
  "storageBucket": "tt-studyplan.appspot.com",
  "messagingSenderId": "215005132642",
  "appId": "1:215005132642:web:a38b8c32e6b2a1a7755e3b",
  "measurementId": "G-WSPEP52PRG"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = getDatabase(app);

// Hàm khởi tạo Firebase (được gọi từ script.js)
function initFirebase() {
    // Kiểm tra nếu Firebase chưa được khởi tạo
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Đọc cấu hình từ file nếu cần
    fetch('firebase-config.json')
        .then(response => response.json())
        .then(config => {
            if (config.apiKey) {
                firebase.initializeApp(config);
            }
        })
        .catch(error => {
            console.log('Không đọc được file cấu hình Firebase, sử dụng cấu hình mặc định');
        });
}

// Các hàm hỗ trợ Firebase
function saveUserData(userId, data) {
    return firebase.database().ref('users/' + userId).set(data);
}

function getUserData(userId) {
    return firebase.database().ref('users/' + userId).once('value');
}

function updateTaskCompletion(userId, week, taskId, completed) {
    return firebase.database().ref(`users/${userId}/tasks/${week}/${taskId}/completed`).set(completed);
}

// Hàm lưu dữ liệu ngày học
export function saveDailyProgress(userId, date, data) {
  const dateKey = date.replace(/\//g, '-'); // Chuyển 10/07/2025 -> 10-07-2025
  set(ref(db, `users/${userId}/progress/${dateKey}`), data);
}

// Hàm lấy dữ liệu tuần
export async function getWeeklyProgress(userId, weekStartDate) {
  const snapshot = await get(child(ref(db), `users/${userId}/progress`));
  if (snapshot.exists()) {
    const allData = snapshot.val();
    // Lọc dữ liệu trong khoảng tuần
    return Object.keys(allData)
      .filter(date => isDateInWeek(date, weekStartDate))
      .map(date => ({ date, ...allData[date] }));
  }
  return [];
}

// Hàm kiểm tra ngày trong tuần
function isDateInWeek(dateString, weekStart) {
  // Logic so sánh ngày
  // Giả sử dateString có dạng "10-07-2025"
  const date = new Date(dateString.replace(/-/g, '/'));
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  return date >= start && date <= end;
}

// Xuất các hàm cần sử dụng ở file khác
export { initFirebase, saveUserData, getUserData, updateTaskCompletion, saveDailyProgress, getWeeklyProgress, isDateInWeek};