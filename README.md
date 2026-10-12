# 🧥 ระบบลงทะเบียนสั่งจองเสื้อคลุมแจ็กเก็ต 2569 (PITSANUVEJ PHICHIT JACKET)
### โรงพยาบาลพิษณุเวช พิจิตร • ฝ่ายพัฒนาทรัพยากรบุคคล (HRD AI Suite)

ระบบเว็บแอปพลิเคชันสำหรับอำนวยความสะดวกให้บุคลากรโรงพยาบาลพิษณุเวช พิจิตร ลงทะเบียนสั่งจองเสื้อคลุมแจ็กเก็ตประจำปี 2569 สีกรมท่าพรีเมียม ปักตราสัญลักษณ์มาตรฐานเครือพริ้นซิเพิล เฮลท์แคร์ และปักข้อความ PITSANUVEJ PHICHIT ออกแบบตามพิมพ์เขียวมาตรฐาน Dual-Platform รองรับสมบูรณ์แบบทั้งบนคอมพิวเตอร์และสมาร์ตโฟน

---

## 📌 ข้อมูลและรายละเอียดโครงการ (Project Specifications)

- **เสื้อเป้าหมาย**: เสื้อคลุมแจ็กเก็ตสีกรมท่า (Navy Blue Bomber Jacket)
- **การปักตราสัญลักษณ์**:
  - **อกซ้าย**: ตราสัญลักษณ์มาตรฐานเครือพริ้นซิเพิล เฮลท์แคร์
  - **ด้านหลัง**: ปักตัวอักษรสีขาวคมชัด `PITSANUVEJ PHICHIT`
- **ราคาประมาณการ**: **ราคาไม่เกิน 500 บาท / ตัว**
- **ระยะเวลาเปิดรับจอง**: **12 - 19 ตุลาคม 2569**
- **แบบฟอร์มลงทะเบียน (Minimal & Streamlined)**:
  1. ค้นหารหัสพนักงาน / ชื่อ-นามสกุล (ระบบ Autocomplete เชื่อมฐานข้อมูลบุคลากร 209 ท่าน)
  2. เลือกขนาดเสื้อ (ไซส์ M - 4XL)
  3. จำนวนที่ต้องการ (ตัว)
  *(ไม่มีการเก็บเบอร์โทรศัพท์, ไม่มีช่องทางการชำระเงิน, ไม่มีหมายเหตุเพิ่มเติม)*

---

## 📏 ตารางขนาดรอบอก (Size Chart)

| ไซส์ (Size) | รอบอก (Chest) |
| :---: | :---: |
| **M** | **40 นิ้ว** |
| **L** | **42 นิ้ว** |
| **XL** | **44 นิ้ว** |
| **2XL** | **46 นิ้ว** |
| **3XL** | **48 นิ้ว** |
| **4XL** | **50 นิ้ว** |

*(40 - 50 นิ้ว คือขนาดรอบอก)*

---

## 🏛️ สถาปัตยกรรมระบบ (Architecture)

```text
projects/13-ลงทะเบียนจองเสื้อ/
├── index.html              # Smart Auto-detect Router (ตรวจจับขนาดจอ & ระบบปฏิบัติการอัตโนมัติ)
├── desktop.html            # มุมมองจอคอมพิวเตอร์ (Widescreen Split View & Live Preview)
├── mobile.html             # มุมมองสมาร์ตโฟน (Touch-first, Bottom Sheet, Ergonomic UI)
├── summary.html            # แดชบอร์ดสรุปยอดสด & สถิติจำแนกไซส์/แผนก & ส่งออก CSV
├── assets/
│   ├── logo.png            # โลโก้ทางการโรงพยาบาลพิษณุเวช
│   ├── jacket_front.webp   # ภาพเสื้อด้านหน้า (อกซ้ายปักตรา)
│   ├── jacket_front.png    # ภาพต้นฉบับความละเอียดสูง
│   ├── jacket_back.webp    # ภาพเสื้อด้านหลัง (ปัก PITSANUVEJ PHICHIT)
│   └── jacket_back.png     # ภาพต้นฉบับความละเอียดสูง
├── data/
│   ├── employees.json      # ฐานข้อมูลบุคลากร 209 ท่าน
│   └── employees-data.js   # โมดูลโหลดข้อมูลแบบ Offline-ready สำหรับ Autocomplete
├── gas/
│   └── Code.gs             # Backend API เชื่อมต่อ Google Sheets
└── README.md               # เอกสารคู่มือโครงการ
```

---

## 🌐 การเข้าถึงระบบ (Live Production)

- **GitHub Pages URL**: [https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/](https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/)
- **มุมมองคอมพิวเตอร์**: [https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/desktop.html](https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/desktop.html)
- **มุมมองมือถือ**: [https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/mobile.html](https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/mobile.html)
- **แดชบอร์ดสรุปยอด**: [https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/summary.html](https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/summary.html)
- **GitHub Repository**: [https://github.com/pitsanuvejphichit/ppch-jacket-booking-2026](https://github.com/pitsanuvejphichit/ppch-jacket-booking-2026)
