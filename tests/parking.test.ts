import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase, type SqliteDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createParkingService } from "@/lib/parking";

const databases: SqliteDatabase[] = [];

function setup() {
  const db = new Database(":memory:");
  initializeDatabase(db);
  databases.push(db);
  const user = (name: string, email: string) =>
    Number(db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, 'test')").run(name, email).lastInsertRowid);
  return { db, parking: createParkingService(db), user };
}

afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
});

describe("parking service security and invariants", () => {
  it("isolates each owner's lots, records, and mutations", () => {
    const { parking, user } = setup();
    const ownerA = user("甲", "a@example.com");
    const ownerB = user("乙", "b@example.com");
    const lot = parking.createLot(ownerA, { name: "甲的停车场", address: "A 路", totalSpots: 2 });

    expect(parking.listLots(ownerB)).toEqual([]);
    expect(() => parking.getLot(ownerB, lot.id)).toThrow(AppError);
    expect(() => parking.enterVehicle(ownerB, { lotId: lot.id, plateNumber: "粤A10001", type: "TEMPORARY" })).toThrow(
      "停车场不存在或您没有访问权限",
    );

    const record = parking.enterVehicle(ownerA, { lotId: lot.id, plateNumber: "粤A10001", type: "TEMPORARY" });
    expect(() => parking.exitVehicle(ownerB, record.id)).toThrow("停车记录不存在或您没有访问权限");
    expect(parking.listRecords(ownerB)).toEqual([]);
  });

  it("rejects entry when a lot has no available spots", () => {
    const { parking, user } = setup();
    const owner = user("甲", "a@example.com");
    const lot = parking.createLot(owner, { name: "满位停车场", address: "A 路", totalSpots: 1 });
    parking.enterVehicle(owner, { lotId: lot.id, plateNumber: "粤A10001", type: "TEMPORARY" });

    expect(() => parking.enterVehicle(owner, { lotId: lot.id, plateNumber: "粤A10002", type: "TEMPORARY" })).toThrow(
      "当前停车场没有可用车位",
    );
  });

  it("allows only one in-progress record for a plate and frees the spot on exit", () => {
    const { parking, user } = setup();
    const owner = user("甲", "a@example.com");
    const firstLot = parking.createLot(owner, { name: "一号场", address: "A 路", totalSpots: 1 });
    const secondLot = parking.createLot(owner, { name: "二号场", address: "B 路", totalSpots: 1 });
    const record = parking.enterVehicle(owner, { lotId: firstLot.id, plateNumber: "粤A10001", type: "TEMPORARY" });

    expect(() => parking.enterVehicle(owner, { lotId: secondLot.id, plateNumber: "粤A10001", type: "MONTHLY" })).toThrow(
      "该车牌已有未完成的停车记录",
    );

    const exit = parking.exitVehicle(owner, record.id, new Date(new Date(record.entryTime).getTime() + 61 * 60 * 1000));
    expect(exit.feeCents).toBe(1600);
    expect(parking.getLot(owner, firstLot.id).spots).toEqual([{ id: 1, number: "P-001", status: "AVAILABLE" }]);

    const nextRecord = parking.enterVehicle(owner, { lotId: firstLot.id, plateNumber: "粤A10001", type: "MONTHLY" });
    expect(nextRecord.status).toBe("IN_PROGRESS");
  });
});
