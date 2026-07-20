# e-REDT Online System (ระบบยื่นคำร้องผัดฟ้องฝากขังออนไลน์)

ระบบยื่นคำร้องผัดฟ้องฝากขังออนไลน์สำหรับสถานีตำรวจในจังหวัดอุดรธานีและศาล (e-REDT) ในรูปแบบ Web Application พัฒนาด้วย **HTML5, CSS3, JavaScript (ES6)**

---

## 📁 โครงสร้างไฟล์ในโครงการ

- **`index.html`**: หน้าเว็บหลักของระบบ (Single Page Application)
- **`styles.css`**: ดีไซน์ระบบ Glassmorphism + Pure White Background และโทนสีตามบทบาท
- **`app.js`**: เอนจินควบคุมระบบ, LocalStorage Database, Google Sheet & Drive Connection
- **`img/logo.png`**: โลโก้หลักของระบบ
- **`package.json`**: ไฟล์ตั้งค่าเซิร์ฟเวอร์เปิดใช้งานระบบ (`npm start`)

---

## 🚀 การเปิดใช้งานระบบ (Getting Started)

### วิธีที่ 1: เปิดใช้งานผ่าน Local Server (แนะนำ)
```bash
npm start
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

### วิธีที่ 2: ดับเบิลคลิกไฟล์
ดับเบิลคลิกที่ไฟล์ `index.html` เพื่อเปิดทดสอบผ่านเว็บเบราว์เซอร์ได้ทันที

---

## 🔑 บัญชีทดสอบระบบ (Seed Accounts)

- **ผู้ดูแลระบบ (Admin)**: Username: `admin` | Password: `admin1234`
- **เจ้าหน้าที่ศาล**: Username: `officer1` | Password: `officer1234`
- **ตำรวจ (สภ.เมืองอุดรธานี)**: Username: `police_udon` | Password: `police1234`
- **ตำรวจ (สภ.กุมภวาปี)**: Username: `police_kumphawapi` | Password: `police1234`
