# Bolt ↔ Windsurf MCP Link + Template Import Flow

เอกสารนี้สำหรับ flow:
1) สร้าง template จาก `bolt.new`
2) นำเข้าใน Windsurf/โปรเจกต์นี้
3) ใช้ใน Template Wizard เพื่อ import เข้า project

---

## 1) ตั้ง MCP server กลาง (ใช้ร่วมกันทั้ง Bolt และ Windsurf)

แนวคิด: ให้ทั้งสองฝั่งชี้ไป MCP server URL เดียวกัน (ไม่ได้ต่อกันตรง ๆ)

ตัวอย่าง endpoint:
- `https://mcp.fusions.dev/mcp`

> ถ้า server ยังเป็น `localhost` ให้เปิดเป็น public URL ก่อน (เช่น reverse proxy / tunnel)

---

## 2) ตั้งค่าใน Bolt

ไปที่ `bolt.new`:
- `Personal Settings` -> `Connectors (MCP)` -> `Add MCP server`

ตั้งค่าตามนี้:
- Name: `bolt_shared`
- URL: `https://mcp.fusions.dev/mcp`
- Transport: `HTTP`
- Authentication: ตามที่ server คุณกำหนด (แนะนำ Bearer token)

---

## 3) ตั้งค่าใน Windsurf (repo นี้)

ไฟล์ที่ใช้: `.mcp.json`

ตอนนี้เพิ่ม profile ไว้แล้วชื่อ `bolt_shared`:

```json
{
  "mcpServers": {
    "bolt_shared": {
      "type": "http",
      "url": "https://mcp.fusions.dev/mcp"
    },
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

สิ่งที่ต้องทำต่อ:
- URL ถูกตั้งเป็น `https://mcp.fusions.dev/mcp` แล้ว
- ถ้าใช้ auth token ให้ตั้งผ่านระบบ secret/credential manager ของ IDE (ไม่ hardcode ลง repo)

---

## 4) Export template จาก Bolt แล้วเตรียมไฟล์เข้า Wizard

สมมติคุณ export โค้ดจาก Bolt ไปที่โฟลเดอร์:
- `C:\tmp\bolt-site`

รันใน repo นี้:

```bash
npm run prepare-bolt-astro-import -- "C:/tmp/bolt-site" bolt-site --name "Bolt Site" --category custom
```

ผลลัพธ์จะอยู่ที่:
- `tmp/prepared-template-imports/bolt-site.import.zip`
- `tmp/prepared-template-imports/bolt-site.file-map.json`

---

## 5) Import เข้า Template Wizard

ในแอปนี้:
1. เปิด `Template Wizard`
2. เลือก `Smart Import (ZIP)`
3. อัปโหลดไฟล์ `*.import.zip`
4. ตรวจ metadata แล้วกด Save

หลัง Save แล้ว template จะขึ้นในรายการให้เลือกใช้งาน

---

## 6) End-to-End Check (แนะนำ)

1. **MCP connectivity**
   - Bolt เรียก MCP ได้
   - Windsurf เรียก MCP ได้
2. **Prepare script**
   - คำสั่ง `prepare-bolt-astro-import` ผ่าน
   - ได้ไฟล์ ZIP/JSON ใน `tmp/prepared-template-imports`
3. **Wizard import**
   - ZIP parse ผ่าน
   - ตรวจเจอ `index.astro`
   - Save template สำเร็จ
4. **Use template**
   - เลือก template ตอนสร้างไซต์ใหม่
   - Preview/Deploy ได้ตามปกติ

---

## Security Checklist

- ใช้ HTTPS เท่านั้น
- เปิด auth ที่ MCP server
- แยก token ตาม environment (dev/prod)
- ไม่ commit token หรือ secret ลง git
- เปิด audit logs บน MCP server
