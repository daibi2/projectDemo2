import type { SqliteDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";

export const HOURLY_RATE_CENTS = 800;

type VehicleType = "TEMPORARY" | "MONTHLY" | "RESERVATION";

type LotRow = {
  id: number;
  name: string;
  address: string;
  total_spots: number;
  available_spots: number;
  occupied_spots: number;
  locked_spots: number;
};

function normalizePlate(plate: string) {
  const normalized = plate.trim().toUpperCase();
  if (normalized.length < 3 || normalized.length > 16) {
    throw new AppError("请输入有效的车牌号。");
  }
  return normalized;
}

function assertVehicleType(type: string): asserts type is VehicleType {
  if (!["TEMPORARY", "MONTHLY", "RESERVATION"].includes(type)) {
    throw new AppError("不支持的车辆类型。");
  }
}

function ownedLot(db: SqliteDatabase, ownerId: number, lotId: number) {
  const lot = db
    .prepare("SELECT id, name, address, total_spots FROM lots WHERE id = ? AND owner_id = ?")
    .get(lotId, ownerId) as { id: number; name: string; address: string; total_spots: number } | undefined;
  if (!lot) throw new AppError("停车场不存在或您没有访问权限。", 404, "LOT_NOT_FOUND");
  return lot;
}

export function createParkingService(db: SqliteDatabase) {
  return {
    createLot(ownerId: number, input: { name: string; address: string; totalSpots: number }) {
      const name = input.name.trim();
      const address = input.address.trim();
      const totalSpots = Number(input.totalSpots);
      if (!name || !address || !Number.isInteger(totalSpots) || totalSpots < 1 || totalSpots > 2000) {
        throw new AppError("请提供停车场名称、地址和 1–2000 之间的车位数。");
      }

      return db.transaction(() => {
        const result = db
          .prepare("INSERT INTO lots (owner_id, name, address, total_spots) VALUES (?, ?, ?, ?)")
          .run(ownerId, name, address, totalSpots);
        const lotId = Number(result.lastInsertRowid);
        const addSpot = db.prepare("INSERT INTO parking_spots (lot_id, number, status) VALUES (?, ?, 'AVAILABLE')");
        for (let index = 1; index <= totalSpots; index += 1) {
          addSpot.run(lotId, `P-${String(index).padStart(3, "0")}`);
        }
        return this.getLot(ownerId, lotId);
      })();
    },

    listLots(ownerId: number) {
      return db
        .prepare(`
          SELECT l.id, l.name, l.address, l.total_spots,
            SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_spots,
            SUM(CASE WHEN s.status = 'OCCUPIED' THEN 1 ELSE 0 END) AS occupied_spots,
            SUM(CASE WHEN s.status = 'RESERVATION_LOCKED' THEN 1 ELSE 0 END) AS locked_spots
          FROM lots l
          JOIN parking_spots s ON s.lot_id = l.id
          WHERE l.owner_id = ?
          GROUP BY l.id
          ORDER BY l.created_at DESC, l.id DESC
        `)
        .all(ownerId) as LotRow[];
    },

    getLot(ownerId: number, lotId: number) {
      const lot = ownedLot(db, ownerId, lotId);
      const spots = db
        .prepare("SELECT id, number, status FROM parking_spots WHERE lot_id = ? ORDER BY number")
        .all(lot.id);
      return { ...lot, spots };
    },

    updateLot(ownerId: number, lotId: number, input: { name: string; address: string }) {
      ownedLot(db, ownerId, lotId);
      const name = input.name.trim();
      const address = input.address.trim();
      if (!name || !address) throw new AppError("停车场名称和地址不能为空。");
      db.prepare("UPDATE lots SET name = ?, address = ? WHERE id = ? AND owner_id = ?").run(name, address, lotId, ownerId);
      return this.getLot(ownerId, lotId);
    },

    deleteLot(ownerId: number, lotId: number) {
      ownedLot(db, ownerId, lotId);
      const record = db
        .prepare("SELECT id FROM parking_records WHERE lot_id = ? LIMIT 1")
        .get(lotId);
      if (record) {
        throw new AppError("已有进出记录的停车场不能删除，以保留收费审计记录。", 409, "LOT_HAS_RECORDS");
      }
      db.prepare("DELETE FROM lots WHERE id = ? AND owner_id = ?").run(lotId, ownerId);
    },

    enterVehicle(ownerId: number, input: { lotId: number; plateNumber: string; type: string }) {
      const lotId = Number(input.lotId);
      const plateNumber = normalizePlate(input.plateNumber);
      assertVehicleType(input.type);

      return db.transaction(() => {
        ownedLot(db, ownerId, lotId);
        const active = db
          .prepare(`
            SELECT r.id FROM parking_records r
            JOIN vehicles v ON v.id = r.vehicle_id
            WHERE r.owner_id = ? AND v.plate_number = ? AND r.status = 'IN_PROGRESS'
          `)
          .get(ownerId, plateNumber);
        if (active) throw new AppError("该车牌已有未完成的停车记录。", 409, "ACTIVE_RECORD_EXISTS");

        const spot = db
          .prepare("SELECT id, number FROM parking_spots WHERE lot_id = ? AND status = 'AVAILABLE' ORDER BY number LIMIT 1")
          .get(lotId) as { id: number; number: string } | undefined;
        if (!spot) throw new AppError("当前停车场没有可用车位。", 409, "NO_AVAILABLE_SPOT");

        const existingVehicle = db
          .prepare("SELECT id FROM vehicles WHERE owner_id = ? AND plate_number = ?")
          .get(ownerId, plateNumber) as { id: number } | undefined;
        const vehicleId = existingVehicle
          ? existingVehicle.id
          : Number(
              db
                .prepare("INSERT INTO vehicles (owner_id, plate_number, type) VALUES (?, ?, ?)")
                .run(ownerId, plateNumber, input.type).lastInsertRowid,
            );
        if (existingVehicle) {
          db.prepare("UPDATE vehicles SET type = ? WHERE id = ?").run(input.type, vehicleId);
        }

        const claimed = db
          .prepare("UPDATE parking_spots SET status = 'OCCUPIED' WHERE id = ? AND status = 'AVAILABLE'")
          .run(spot.id);
        if (claimed.changes !== 1) throw new AppError("车位状态已变化，请重试。", 409, "SPOT_UNAVAILABLE");

        const entryTime = new Date().toISOString();
        const recordId = Number(
          db
            .prepare(`
              INSERT INTO parking_records (owner_id, lot_id, spot_id, vehicle_id, entry_time, status)
              VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS')
            `)
            .run(ownerId, lotId, spot.id, vehicleId, entryTime).lastInsertRowid,
        );
        return { id: recordId, lotId, spotNumber: spot.number, plateNumber, entryTime, status: "IN_PROGRESS" };
      })();
    },

    exitVehicle(ownerId: number, recordId: number, exitedAt = new Date()) {
      return db.transaction(() => {
        const record = db
          .prepare(`
            SELECT r.id, r.spot_id, r.entry_time, r.status, v.plate_number, s.number AS spot_number
            FROM parking_records r
            JOIN vehicles v ON v.id = r.vehicle_id
            JOIN parking_spots s ON s.id = r.spot_id
            WHERE r.id = ? AND r.owner_id = ?
          `)
          .get(recordId, ownerId) as
          | { id: number; spot_id: number; entry_time: string; status: string; plate_number: string; spot_number: string }
          | undefined;
        if (!record) throw new AppError("停车记录不存在或您没有访问权限。", 404, "RECORD_NOT_FOUND");
        if (record.status !== "IN_PROGRESS") throw new AppError("该停车记录已完成。", 409, "RECORD_COMPLETED");

        const durationMs = Math.max(0, exitedAt.getTime() - new Date(record.entry_time).getTime());
        const billedHours = Math.max(1, Math.ceil(durationMs / (60 * 60 * 1000)));
        const feeCents = billedHours * HOURLY_RATE_CENTS;
        const exitTime = exitedAt.toISOString();
        db.prepare(`
          UPDATE parking_records SET exit_time = ?, fee_cents = ?, status = 'COMPLETED'
          WHERE id = ? AND owner_id = ? AND status = 'IN_PROGRESS'
        `).run(exitTime, feeCents, record.id, ownerId);
        db.prepare("UPDATE parking_spots SET status = 'AVAILABLE' WHERE id = ?").run(record.spot_id);

        return {
          id: record.id,
          plateNumber: record.plate_number,
          spotNumber: record.spot_number,
          entryTime: record.entry_time,
          exitTime,
          durationMinutes: Math.ceil(durationMs / 60000),
          feeCents,
          status: "COMPLETED",
        };
      })();
    },

    listRecords(ownerId: number) {
      return db
        .prepare(`
          SELECT r.id, r.entry_time AS entryTime, r.exit_time AS exitTime, r.fee_cents AS feeCents, r.status,
            v.plate_number AS plateNumber, v.type AS vehicleType, l.name AS lotName, s.number AS spotNumber
          FROM parking_records r
          JOIN vehicles v ON v.id = r.vehicle_id
          JOIN lots l ON l.id = r.lot_id
          JOIN parking_spots s ON s.id = r.spot_id
          WHERE r.owner_id = ?
          ORDER BY CASE WHEN r.status = 'IN_PROGRESS' THEN 0 ELSE 1 END, r.entry_time DESC
          LIMIT 50
        `)
        .all(ownerId);
    },
  };
}

export type ParkingService = ReturnType<typeof createParkingService>;
