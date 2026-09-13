"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Lot = {
  id: number;
  name: string;
  address: string;
  total_spots: number;
  available_spots: number;
  occupied_spots: number;
  locked_spots: number;
};

type Record = {
  id: number;
  entryTime: string;
  exitTime: string | null;
  feeCents: number | null;
  status: "IN_PROGRESS" | "COMPLETED";
  plateNumber: string;
  vehicleType: string;
  lotName: string;
  spotNumber: string;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "请求失败，请重试。");
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const vehicleTypes = {
  TEMPORARY: "临时车辆",
  MONTHLY: "月租车辆",
  RESERVATION: "预约车辆",
};

export function Dashboard({ userName }: { userName: string }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState({ lotId: "", plateNumber: "", type: "TEMPORARY" });
  const [newLot, setNewLot] = useState({ name: "", address: "", totalSpots: "20" });
  const [editingLot, setEditingLot] = useState<Lot | null>(null);

  const load = useCallback(async () => {
    try {
      const [lotData, recordData] = await Promise.all([
        api<{ lots: Lot[] }>("/api/lots"),
        api<{ records: Record[] }>("/api/parking/records"),
      ]);
      setLots(lotData.lots);
      setRecords(recordData.records);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "加载数据失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLot(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/lots", { method: "POST", body: JSON.stringify({ ...newLot, totalSpots: Number(newLot.totalSpots) }) });
      setNewLot({ name: "", address: "", totalSpots: "20" });
      setNotice("停车场已创建，所有车位已设为可用。");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建失败。");
    }
  }

  async function submitEntry(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await api<{ record: { spotNumber: string; plateNumber: string } }>("/api/parking/entry", {
        method: "POST",
        body: JSON.stringify({ ...entry, lotId: Number(entry.lotId) }),
      });
      setNotice(`${data.record.plateNumber} 已入场，分配至 ${data.record.spotNumber}。`);
      setEntry({ lotId: "", plateNumber: "", type: "TEMPORARY" });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "入场失败。");
    }
  }

  async function exitVehicle(recordId: number) {
    try {
      const data = await api<{ record: { feeCents: number; plateNumber: string } }>(`/api/parking/exit/${recordId}`, { method: "POST" });
      setNotice(`${data.record.plateNumber} 已出场，收费 ¥${(data.record.feeCents / 100).toFixed(2)}。`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "出场失败。");
    }
  }

  async function saveLot(event: FormEvent) {
    event.preventDefault();
    if (!editingLot) return;
    try {
      await api(`/api/lots/${editingLot.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editingLot.name, address: editingLot.address }),
      });
      setEditingLot(null);
      setNotice("停车场信息已更新。");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "更新失败。");
    }
  }

  async function deleteLot(lot: Lot) {
    if (!window.confirm(`确定删除“${lot.name}”吗？没有任何停车记录的停车场才可删除。`)) return;
    try {
      await api(`/api/lots/${lot.id}`, { method: "DELETE" });
      setNotice("停车场已删除。");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除失败。");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const activeRecords = records.filter((record) => record.status === "IN_PROGRESS");

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PARKING OPERATIONS</p>
          <h1>泊位管家</h1>
        </div>
        <div className="account">
          <span>你好，{userName}</span>
          <button className="text-button" onClick={() => void logout()}>退出登录</button>
        </div>
      </header>

      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      <section className="stats">
        <article><span>停车场</span><strong>{lots.length}</strong></article>
        <article><span>可用车位</span><strong>{lots.reduce((sum, lot) => sum + lot.available_spots, 0)}</strong></article>
        <article><span>在场车辆</span><strong>{activeRecords.length}</strong></article>
      </section>

      <section className="workspace">
        <div className="panel entry-panel">
          <div className="panel-heading"><div><p className="eyebrow">LIVE FLOW</p><h2>车辆入场</h2></div><span className="rate">¥8 / 小时</span></div>
          <form onSubmit={submitEntry} className="form-grid">
            <label>选择停车场
              <select required value={entry.lotId} onChange={(event) => setEntry({ ...entry, lotId: event.target.value })}>
                <option value="">请选择</option>
                {lots.map((lot) => <option value={lot.id} key={lot.id}>{lot.name} · {lot.available_spots} 个空位</option>)}
              </select>
            </label>
            <label>车牌号
              <input required placeholder="例如：粤B·A1234" value={entry.plateNumber} onChange={(event) => setEntry({ ...entry, plateNumber: event.target.value })} />
            </label>
            <label>车辆类型
              <select value={entry.type} onChange={(event) => setEntry({ ...entry, type: event.target.value })}>
                {Object.entries(vehicleTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <button className="primary" disabled={!lots.length}>分配车位并入场</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-heading"><div><p className="eyebrow">MANAGE</p><h2>新建停车场</h2></div></div>
          <form onSubmit={createLot} className="form-grid compact">
            <label>名称<input required value={newLot.name} onChange={(event) => setNewLot({ ...newLot, name: event.target.value })} placeholder="例如：科技园 A 区" /></label>
            <label>地址<input required value={newLot.address} onChange={(event) => setNewLot({ ...newLot, address: event.target.value })} placeholder="例如：创新大道 88 号" /></label>
            <label>固定车位数<input required type="number" min="1" max="2000" value={newLot.totalSpots} onChange={(event) => setNewLot({ ...newLot, totalSpots: event.target.value })} /></label>
            <button className="secondary">创建并生成车位</button>
          </form>
        </div>
      </section>

      <section className="panel lots-panel">
        <div className="panel-heading"><div><p className="eyebrow">YOUR PORTFOLIO</p><h2>我的停车场</h2></div></div>
        {loading ? <p className="empty">正在加载…</p> : !lots.length ? <p className="empty">还没有停车场。请创建您的第一个停车场。</p> : (
          <div className="lot-grid">
            {lots.map((lot) => (
              <article className="lot-card" key={lot.id}>
                <div className="lot-card-title"><div><h3>{lot.name}</h3><p>{lot.address}</p></div><span>{lot.total_spots} 位</span></div>
                <div className="availability"><strong>{lot.available_spots}</strong><span>可用车位</span><div><i style={{ width: `${(lot.available_spots / lot.total_spots) * 100}%` }} /></div></div>
                <div className="lot-numbers"><span>占用 {lot.occupied_spots}</span><span>锁定 {lot.locked_spots}</span></div>
                <div className="actions"><button onClick={() => setEditingLot({ ...lot })}>编辑</button><button className="danger" onClick={() => void deleteLot(lot)}>删除</button></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel records-panel">
        <div className="panel-heading"><div><p className="eyebrow">TODAY & HISTORY</p><h2>停车记录</h2></div></div>
        {!records.length ? <p className="empty">暂无停车记录。</p> : <div className="record-list">
          {records.map((record) => <div className="record" key={record.id}>
            <div><strong>{record.plateNumber}</strong><span>{vehicleTypes[record.vehicleType as keyof typeof vehicleTypes]} · {record.lotName} / {record.spotNumber}</span></div>
            <div><span>{new Date(record.entryTime).toLocaleString("zh-CN")}</span><b className={record.status === "IN_PROGRESS" ? "active" : ""}>{record.status === "IN_PROGRESS" ? "在场中" : `¥${((record.feeCents ?? 0) / 100).toFixed(2)}`}</b></div>
            {record.status === "IN_PROGRESS" && <button className="primary small" onClick={() => void exitVehicle(record.id)}>办理出场</button>}
          </div>)}
        </div>}
      </section>

      {editingLot && <div className="modal-backdrop"><form className="modal" onSubmit={saveLot}>
        <h2>编辑停车场</h2>
        <label>名称<input required value={editingLot.name} onChange={(event) => setEditingLot({ ...editingLot, name: event.target.value })} /></label>
        <label>地址<input required value={editingLot.address} onChange={(event) => setEditingLot({ ...editingLot, address: event.target.value })} /></label>
        <p>固定车位数：{editingLot.total_spots}，创建后不可修改。</p>
        <div className="actions"><button type="button" onClick={() => setEditingLot(null)}>取消</button><button className="primary">保存更改</button></div>
      </form></div>}
    </main>
  );
}
