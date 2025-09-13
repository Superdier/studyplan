# Studyplan Website

## Overview
Studyplan is a personal study tracker and planner designed for Japanese language learners, especially those preparing for JLPT exams. It helps you organize your weekly study schedule, track progress, manage resources, and use interactive tools for writing practice and text-to-speech.

## Features
- Weekly study schedule with task management
- Progress tracking and statistics (completion rate, streaks, hours)
- Resource management (textbooks, listening, websites)
- Interactive writing grid for Kanji practice
- Text-to-speech tool for Japanese reading
- Countdown timer and break reminders
- Responsive design for desktop and mobile

## Getting Started
1. **Clone the repository**
   ```bash
   git clone https://github.com/Superdier/studyplan.git
   cd studyplan
   ```
2. **Install dependencies (if any)**
   This project is static and does not require npm install for basic usage. For development, you may use [live-server](https://www.npmjs.com/package/live-server):
   ```bash
   live-server --port=3000
   ```
3. **Open in browser**
   Navigate to `http://localhost:3000` to use the app.

## Folder Structure
- `public/` - Main website files
  - `index.html` - Main HTML file
  - `css/` - Stylesheets
  - `js/` - JavaScript files
  - `assets/` - Fonts and images
- `firebase-config.json` - Firebase configuration
- `database.rules.json` - Firebase database rules
- `README.md` - Project documentation

## Technologies Used
- HTML, CSS, JavaScript
- Chart.js for statistics and charts
- Firebase Realtime Database for data storage
- jsPDF for PDF export

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License
This project is licensed under the MIT License.

## Author
Superdier

---
For questions or feedback, please open an issue on GitHub.
