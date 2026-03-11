# คู่มือการใช้งาน FusionOps (ฉบับทีมงาน)

## ภาพรวม

FusionOps เป็นระบบรวมงาน PPC Landing Page ตั้งแต่สร้างหน้า, ตั้งค่า tracking, จัดการ deployment, ติดตาม spend และตรวจสุขภาพระบบในที่เดียว

เมนูหลักที่ใช้งานประจำ:

- `Dashboard` ภาพรวมระบบ
- `Spend Dashboard` ต้นทุน/ผลลัพธ์รายวัน
- `Voluum Explorer` วิเคราะห์ข้อมูลจาก Voluum
- `Account Map` แมปบัญชีโฆษณา-บัตร-โปรไฟล์
- `My Sites` รายการเว็บไซต์ทั้งหมด
- `LP Wizard` สร้าง LP ใหม่แบบ step-by-step
- `Ops Center` จัดการโดเมน/บัญชี/ระบบปฏิบัติการ
- `Deploys` ประวัติการ deploy
- `Tracking Test` ทดสอบพิกเซลและ tracking
- `Settings` ตั้งค่า API และระบบเชื่อมต่อ

---

## 1) เริ่มใช้งานครั้งแรก

### 1.1 เปิดระบบ

1. เปิดโปรเจกต์
2. รันคำสั่ง:

```bash
npm run dev -- --host 0.0.0.0 --port 4321
```

3. เข้าใช้งานผ่าน `http://localhost:4321`

### 1.2 ตั้งค่าในหน้า Settings (จำเป็น)

ไปที่ `Settings` แล้วบันทึกคีย์ที่ต้องใช้:

- Cloudflare (`cfAccountId`, `cfApiToken`)
- Voluum (`voluumAccessKeyId`, `voluumAccessKey`)
- LendingCard (`lcToken`)
- Neon / API ที่องค์กรใช้งาน
- ตัวเลือก deploy (Netlify/Vercel/AWS/VPS) ตามช่องทางที่ทีมใช้จริง

หลังบันทึก ให้ดูสถานะบน TopBar ว่าเป็น `✓` แล้ว

---

## 2) Workflow มาตรฐานประจำวัน

## 2.1 สร้างหน้าใหม่ (LP Wizard)

1. เข้า `LP Wizard`
2. กรอกข้อมูลแบรนด์/สินค้า/ดีไซน์/คอนเทนต์
3. ตั้งค่า tracking
4. ตรวจใน Review และยืนยันสร้าง
5. ระบบจะเพิ่มรายการไปที่ `My Sites`

## 2.2 จัดการเว็บไซต์

1. เข้า `My Sites`
2. ค้นหา/กรองตามสถานะ
3. อัปเดตข้อมูลโดเมน/การ deploy
4. ใช้ Duplicate เมื่อต้องทำเวอร์ชันใหม่เร็วๆ

## 2.3 Deploy

1. เข้า `Ops Center` เพื่อตรวจว่าบัญชี/โดเมนพร้อม
2. deploy จาก flow ของเว็บที่ต้องการ
3. ตรวจผลที่ `Deploys`

## 2.4 ตรวจ Spend และผลลัพธ์

1. เข้า `Spend Dashboard`
2. เลือกช่วงเวลา (7d/14d/30d/MTD/Today)
3. ดู Overview, Daily Log, Per Account, Per Domain, P&L
4. กด `Sync Now` เมื่อต้องดึงข้อมูลล่าสุด

## 2.5 ตรวจ Voluum

1. เข้า `Voluum Explorer`
2. กด `Fetch Data`
3. ตรวจข้อมูล Campaign/Conversion/Offer/Matching

---

## 3) โหมดพนักงาน (ซ่อนรายได้ชั่วคราว)

สำหรับการใช้งานในทีมที่ยังไม่มี login/role ฝั่ง backend:

1. เข้า `Settings`
2. เปิดตัวเลือก `Hide revenue and profit in employee view`
3. กด Save

ผลลัพธ์:

- ตัวเลขรายได้/กำไร/ROI/Payout จะถูก mask เป็น `Hidden` ในหลายหน้า
- เหมาะสำหรับใช้งานชั่วคราวภายในทีม

หมายเหตุ:

- โหมดนี้เป็นการซ่อนใน UI เป็นหลัก ยังไม่ใช่การป้องกันข้อมูลระดับ backend

---

## 4) การตรวจสอบปัญหาเบื้องต้น

## 4.1 Dashboard ขึ้นเตือนการเชื่อมต่อ

- ตรวจที่ `Settings` ว่า key/ID กรอกครบ
- ใช้ปุ่มทดสอบการเชื่อมต่อในแต่ละ service
- ตรวจ `API Health` และ `Error Log`

## 4.2 Spend/Voluum ไม่อัปเดต

- ตรวจ Voluum key และช่วงเวลา
- ตรวจ LendingCard token
- กด `Sync Now` / `Fetch Data` ซ้ำ

## 4.3 Deploy ไม่สำเร็จ

- ตรวจ `Ops Center` ว่าบัญชี/โซน DNS ถูกต้อง
- เช็กประวัติที่ `Deploys`
- เปิด `Error Log` เพื่อดูสาเหตุละเอียด

---

## 5) แนวปฏิบัติทีม (แนะนำ)

- ให้ admin เป็นผู้จัดการ `Settings` เท่านั้น
- จัดรอบตรวจ `API Health` อย่างน้อยวันละ 1 ครั้ง
- ใช้ `Template Manager` คุม default template ของทีม
- ก่อน deploy ใหญ่ ควรเช็ก Tracking Test ทุกครั้ง

---

## 6) Checklist ก่อนเริ่มงานในแต่ละวัน

- [ ] ระบบเปิดได้และหน้า `Dashboard` ปกติ
- [ ] Voluum, LendingCard, Neon/API มีสถานะพร้อมใช้งาน
- [ ] ตั้งช่วงเวลาใน `Spend Dashboard` ถูกต้อง
- [ ] ตรวจ Error Log ว่าไม่มี error สำคัญค้าง
- [ ] ถ้าเป็นเครื่องพนักงาน เปิดโหมดซ่อนรายได้แล้ว

---

## 7) Checklist ก่อนเลิกงาน

- [ ] Sync ข้อมูลรอบสุดท้ายใน Spend Dashboard
- [ ] ตรวจ deploy ที่ทำวันนี้ใน `Deploys`
- [ ] ทบทวน Error Log และบันทึก issue ที่ต้องตามต่อ
- [ ] ยืนยันค่าใน Settings ไม่ถูกแก้ผิดบัญชี

