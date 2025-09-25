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
