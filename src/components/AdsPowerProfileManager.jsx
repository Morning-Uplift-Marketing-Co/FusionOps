import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import {
  adspowerUsesWorkerProxy,
  getAdsPowerStatus,
  listAdsPowerProfiles,
  resolveAdsPowerBaseUrl,
  startAdsPowerBrowser,
  stopAdsPowerBrowser,
} from "../services/adspower";

function proxyLabel(row) {
  const p = row?.user_proxy_config;
  if (!p || typeof p !== "object") return row?.ip || "—";
  const host = p.proxy_host || p.host;
  const port = p.proxy_port || p.port;
  if (host && port) return `${host}:${port}`;
  if (row?.ip) return row.ip;
  return p.proxy_soft || "—";
}

function formatTime(ts) {
  if (ts == null || ts === "") return "—";
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return String(ts);
  const ms = n < 1e12 ? n * 1000 : n;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ts);
  }
}

export function AdsPowerProfileManager({ settings = {}, ops = {} }) {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [apiOk, setApiOk] = useState(null);
  const [loadHint, setLoadHint] = useState(null);
  const [flash, setFlash] = useState(null);
  const [rowBusy, setRowBusy] = useState({});
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const notifyRef = useRef(ops?.notify);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    notifyRef.current = ops?.notify;
  }, [ops?.notify]);

  const showFlash = useCallback((msg, type = "info") => {
    setFlash({ msg, type });
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 6000);
    try {
      notifyRef.current?.(msg, type);
    } catch {
      /* ignore */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const st = await getAdsPowerStatus(settings);
      setApiOk(st.ok);
      if (!st.ok) {
        setProfiles([]);
        const err =
          st.error ||
          "Local API ไม่พร้อม — ตรวจสอบว่าเปิด AdsPower และ Local API (Settings → Automation)";
        setLoadHint(err);
        showFlash(err, "error");
        return;
      }
      setLoadHint(null);
      const r = await listAdsPowerProfiles(settings, { page, limit });
      if (r.ok) {
        setLoadHint(null);
        setProfiles(Array.isArray(r.profiles) ? r.profiles : []);
      } else {
        setProfiles([]);
        const err = r.error || "โหลดรายการโปรไฟล์ไม่สำเร็จ";
        setLoadHint(err);
        showFlash(err, "error");
      }
    } catch (e) {
      setProfiles([]);
      const err = e?.message || "คำขอล้มเหลว";
      setLoadHint(err);
      showFlash(err, "error");
    } finally {
      setLoading(false);
    }
  }, [settings, page, showFlash]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const groupNames = useMemo(() => {
    const s = new Set();
    for (const p of profiles) {
      const g = p.group_name;
      if (g) s.add(g);
    }
    return [...s].sort();
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (groupFilter && (p.group_name || "") !== groupFilter) return false;
      if (!q) return true;
      const hay = [p.name, p.profile_id, String(p.profile_no ?? ""), p.group_name, p.ip, proxyLabel(p)]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [profiles, search, groupFilter]);

  const setBusy = (id, v) => {
    setRowBusy((b) => {
      const n = { ...b };
      if (v) n[id] = v;
      else delete n[id];
      return n;
    });
  };

  const onStart = async (row) => {
    const id = row.profile_id;
    if (!id) return;
    setBusy(id, "start");
    try {
      const r = await startAdsPowerBrowser(settings, { profile_id: id });
      if (r.ok) showFlash(`เปิดเบราว์เซอร์: ${row.name || id}`, "success");
      else showFlash(r.error || "Start ล้มเหลว", "error");
      await loadList();
    } catch (e) {
      showFlash(e?.message || "Start ล้มเหลว", "error");
    } finally {
      setBusy(id, null);
    }
  };

  const onStop = async (row) => {
    const id = row.profile_id;
    if (!id) return;
    setBusy(id, "stop");
    try {
      const r = await stopAdsPowerBrowser(settings, { profile_id: id });
      if (r.ok) showFlash(`ปิดเบราว์เซอร์: ${row.name || id}`, "success");
      else showFlash(r.error || "Stop ล้มเหลว", "error");
      await loadList();
    } catch (e) {
      showFlash(e?.message || "Stop ล้มเหลว", "error");
    } finally {
      setBusy(id, null);
    }
  };

  const canNext = profiles.length >= limit;
  const effectiveBase = resolveAdsPowerBaseUrl(settings);
  const mixedContentLikely =
    !adspowerUsesWorkerProxy(settings) &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    /^http:\/\//i.test(effectiveBase) &&
    /\b127\.0\.0\.1\b|\blocalhost\b|local\.adspower\.net/i.test(effectiveBase);
  const devHint = adspowerUsesWorkerProxy(settings) ? (
    import.meta.env.DEV ? (
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2 leading-relaxed">
        Dev + Base URL แบบ <strong>https://…</strong> → เรียกผ่าน <strong>API Worker</strong> (เลี่ยง CORS กับ ngrok) ค่าในฟอร์มส่งไปกับคำขอได้โดยไม่ต้อง Save ก่อน Test — ต้องชี้{" "}
        <code className="text-[9px]">VITE_API_BASE</code> ไป Worker ที่ deploy แล้ว
      </p>
    ) : (
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2 leading-relaxed">
        แดชบอร์ด HTTPS เรียก AdsPower ผ่าน <strong>API Worker</strong> — ตั้ง Base URL เป็น <strong>https://…</strong> (tunnel ไปพอร์ต 50325) แล้วกด{" "}
        <strong>Save</strong> ใน Settings → Automation เพื่อให้ Worker อ่านค่าจาก D1
      </p>
    )
  ) : import.meta.env.DEV ? null : (
    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2">
      Production: ตั้ง Base URL เป็น HTTPS tunnel ไปยังเครื่องที่รัน AdsPower
    </p>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold m-0">AdsPower</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] m-0">
            โปรไฟล์จาก Local API · หน้า {page}
            {apiOk === true && (
              <Badge className="ml-2 bg-emerald-500/15 text-emerald-400 text-[10px]">API OK</Badge>
            )}
            {apiOk === false && (
              <Badge className="ml-2 bg-red-500/15 text-red-400 text-[10px]">API ไม่พร้อม</Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={loadList} disabled={loading}>
            {loading ? "⏳ …" : "↻ Refresh"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← ก่อนหน้า
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!canNext || loading} onClick={() => setPage((p) => p + 1)}>
            ถัดไป →
          </Button>
        </div>
      </div>

      {flash && (
        <div
          className={`px-3 py-2 rounded-md text-xs font-medium ${
            flash.type === "error"
              ? "bg-red-500/15 text-red-400 border border-red-500/20"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {mixedContentLikely && (
        <div className="px-3 py-2 rounded-md text-xs font-medium bg-amber-500/10 text-amber-100 border border-amber-500/25 leading-relaxed">
          หน้าแดชบอร์ดเป็น <strong>HTTPS</strong> แต่ Local API เป็น <strong>HTTP</strong> — เบราว์เซอร์จะบล็อกการเรียกไป{" "}
          <code className="text-[10px] opacity-90">127.0.0.1:50325</code> โดยเงียบ
          <br />
          แก้ไข: <strong>Settings → Automation → AdsPower Local API → Base URL</strong> ใส่ URL แบบ{" "}
          <strong>HTTPS</strong> จาก tunnel (เช่น Cloudflare Tunnel / ngrok) ไปที่เครื่องที่รัน AdsPower พอร์ต 50325
          <br />
          หรือเปิดแดชบอร์ดจาก <strong>dev บนเครื่องเดียวกัน</strong> (<code className="text-[10px]">npm run dev</code> ใช้ proxy{" "}
          <code className="text-[10px]">/adspower-local</code>)
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">ค้นหา</label>
          <Input
            className="h-8 text-xs"
            placeholder="ชื่อ, profile id, กลุ่ม, proxy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-44">
          <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">กลุ่ม (หน้านี้)</label>
          <select
            className="w-full h-8 px-2 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="">ทุกกลุ่ม</option>
            {groupNames.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "บนหน้านี้", value: profiles.length },
          { label: "หลังกรอง", value: filtered.length },
          { label: "ต่อหน้า", value: limit },
          { label: "หน้า", value: page },
        ].map((s) => (
          <Card key={s.label} className="bg-[hsl(var(--card))]">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-[hsl(var(--foreground))]">{s.value}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[hsl(var(--card))] overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[hsl(var(--border))] hover:bg-transparent">
                  <TableHead className="text-[10px] h-9">ชื่อ</TableHead>
                  <TableHead className="text-[10px] h-9">No.</TableHead>
                  <TableHead className="text-[10px] h-9">Profile ID</TableHead>
                  <TableHead className="text-[10px] h-9">กลุ่ม</TableHead>
                  <TableHead className="text-[10px] h-9">Proxy / IP</TableHead>
                  <TableHead className="text-[10px] h-9">Platform</TableHead>
                  <TableHead className="text-[10px] h-9">เปิดล่าสุด</TableHead>
                  <TableHead className="text-[10px] h-9 text-right">การทำงาน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-xs text-[hsl(var(--muted-foreground))] py-8 text-center max-w-xl mx-auto">
                      {loading
                        ? "กำลังโหลด…"
                        : loadHint
                          ? loadHint
                          : profiles.length > 0
                            ? "ไม่มีรายการตรงตัวกรอง — ล้างช่องค้นหาหรือเลือก “ทุกกลุ่ม”"
                            : "ไม่มีโปรไฟล์ใน API — ตรวจสอบ API Key (ถ้าเปิด security) และว่า AdsPower รันบนเครื่องเดียวกับที่เรียก Local API"}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((row) => {
                  const id = row.profile_id;
                  const busy = rowBusy[id];
                  return (
                    <TableRow key={id || row.profile_no} className="border-[hsl(var(--border))]">
                      <TableCell className="text-xs font-medium max-w-[160px] truncate">{row.name || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{row.profile_no ?? "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono max-w-[120px] truncate" title={id}>
                        {id || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{row.group_name || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono max-w-[140px] truncate" title={proxyLabel(row)}>
                        {proxyLabel(row)}
                      </TableCell>
                      <TableCell className="text-xs">{row.platform || "—"}</TableCell>
                      <TableCell className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                        {formatTime(row.last_open_time)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            className="h-7 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={!!busy || !id}
                            onClick={() => onStart(row)}
                          >
                            {busy === "start" ? "…" : "Start"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            disabled={!!busy || !id}
                            onClick={() => onStop(row)}
                          >
                            {busy === "stop" ? "…" : "Stop"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {devHint}
    </div>
  );
}
